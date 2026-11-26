"""Respaldo, restauración y migración aislados para compras asistidas."""
import argparse
import csv
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import time

from dotenv import dotenv_values
import pymysql
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'toco_madera'
SOURCE_PORT = 3306
SOURCE_UUID = '75d9b091-3239-11f1-9208-60cf84707dee'
TARGET = 'toco_madera_compras_pruebas'
PORT = 33317
VERSION = '8.4.8'
VIEWS = ('vw_saldos_pedidos', 'vw_stock_lotes', 'vw_stock_materiales', 'vw_stock_productos')
ARTIFACTS = ('respaldo.sql', 'vistas.json')
BIN = Path(os.environ.get('TOCO_MYSQL_BIN', r'C:\Program Files\MySQL\MySQL Server 8.4\bin'))
MIGRATION = ROOT / 'database/migrations/20261125_01_compras_asistidas.sql'
DETACHED = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP


class SafetyError(RuntimeError):
    """Mensaje seguro para terminal."""


def usar_puerto_aislado(port):
    global PORT
    if port not in (33317, 33318):
        raise SafetyError('El puerto debe ser uno de los destinos aislados autorizados.')
    PORT = port


def rows(connection, sql, parameters=()):
    with connection.cursor() as cursor:
        cursor.execute(sql, parameters)
        return cursor.fetchall()


def identity(connection):
    database, port, uuid, datadir, version = rows(
        connection, 'SELECT DATABASE(), @@port, @@server_uuid, @@datadir, @@version'
    )[0]
    return dict(database=database, port=int(port), uuid=uuid,
                datadir=str(Path(datadir).resolve()), version=version)


def assert_source(actual):
    if (actual['database'], actual['port'], actual['uuid'], actual['version']) != (
        SOURCE, SOURCE_PORT, SOURCE_UUID, VERSION
    ):
        raise SafetyError('La conexión no coincide con el servidor principal esperado.')


def assert_isolated(actual, folder, expected_uuid, database=TARGET):
    if (actual['port'] != PORT or actual['database'] != database
            or actual['uuid'] == SOURCE_UUID or actual['uuid'] != expected_uuid
            or actual['version'] != VERSION
            or Path(actual['datadir']).resolve() != (folder / 'data').resolve()):
        raise SafetyError('La conexión no coincide con la instancia aislada verificada.')


def source_args():
    alternate = os.environ.get('TOCO_MYSQL_BACKUP_ENV')
    if not alternate:
        raise SafetyError('Configura TOCO_MYSQL_BACKUP_ENV con el archivo privado.')
    config = Path(alternate).expanduser().resolve()
    if config.is_relative_to(ROOT) or not config.is_file():
        raise SafetyError('El archivo privado debe existir fuera del repositorio.')
    try:
        url = make_url(dotenv_values(config, interpolate=False)['DATABASE_URL'])
    except (KeyError, TypeError, ValueError, ArgumentError):
        raise SafetyError('El archivo requiere un DATABASE_URL válido.') from None
    if (url.drivername not in ('mysql', 'mysql+pymysql') or url.database != SOURCE
            or url.host not in ('localhost', '127.0.0.1', '::1')
            or (url.port or SOURCE_PORT) != SOURCE_PORT or not url.username or not url.password):
        raise SafetyError('El origen debe ser toco_madera en el puerto local 3306.')
    return dict(host=url.host, port=SOURCE_PORT, user=url.username, password=url.password,
                database=SOURCE, charset='utf8mb4', connect_timeout=5)


def target_args(password, database=TARGET):
    return dict(host='127.0.0.1', port=PORT, user='root', password=password,
                database=database, charset='utf8mb4', connect_timeout=3)


def check_private(path):
    # Nunca confiar en que un archivo movido heredó automáticamente las ACL del directorio.
    env = dict(os.environ, TOCO_PRIVATE_PATH=str(path))
    code = '''
$ErrorActionPreference = 'Stop'
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$acl = Get-Acl -LiteralPath $env:TOCO_PRIVATE_PATH
$access = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
if (-not $access -or @($access | Where-Object {
  $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Value -ne $sid
}).Count -gt 0) { exit 1 }
'''
    result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', code],
                            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    if result.returncode:
        raise SafetyError('La carpeta o el archivo tiene permisos de acceso no previstos.')


def private_workspace():
    temp = Path(tempfile.gettempdir()).resolve()
    if temp.is_relative_to(ROOT):
        raise SafetyError('El directorio temporal debe estar fuera del repositorio.')
    folder = Path(tempfile.mkdtemp(prefix='toco-compras-pruebas-', dir=temp))
    raw = subprocess.check_output(['whoami.exe', '/user', '/fo', 'csv', '/nh'], text=True)
    sid = next(csv.reader(raw.splitlines()))[-1]
    if not re.fullmatch(r'S-\d+(?:-\d+)+', sid):
        raise SafetyError('No se pudo identificar la cuenta local para proteger la carpeta.')
    subprocess.run(['icacls.exe', str(folder), '/inheritance:r', '/grant:r', f'*{sid}:(OI)(CI)F'],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    check_private(folder)
    return folder


def workspace(folder):
    folder = folder.resolve()
    if not folder.is_dir() or folder.is_relative_to(ROOT):
        raise SafetyError('Selecciona una carpeta privada fuera del repositorio.')
    check_private(folder)
    return folder


def private_file(folder, name):
    path = folder / name
    if not path.is_file() or path.resolve().parent != folder:
        raise SafetyError('Falta un archivo requerido o está fuera de la carpeta privada.')
    check_private(path)
    return path


def write_json(folder, name, value):
    with (folder / name).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, sort_keys=True)


def read_json(folder, name):
    return json.loads(private_file(folder, name).read_text(encoding='utf-8'))


def file_hash(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def objects(connection):
    return sorted(rows(connection, 'SHOW FULL TABLES'))


def view_definitions(connection):
    return rows(connection, '''
        SELECT TABLE_NAME, VIEW_DEFINITION, SECURITY_TYPE, CHECK_OPTION
        FROM information_schema.views WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME
    ''')


def check_aux_visibility(grants):
    # El inventario de information_schema omite objetos que la cuenta no puede ver.
    direct = {'*.*': set(), SOURCE + '.*': set()}
    for grant in grants:
        if grant.startswith('REVOKE '):
            raise SafetyError('La cuenta de respaldo tiene restricciones parciales.')
        match = re.match(r'GRANT (.+?) ON (.+?) TO ', grant)
        if match:
            scope = match[2].replace(chr(96), '')
            if scope in direct:
                direct[scope].update(part.strip() for part in match[1].split(','))
    global_grants = direct['*.*']
    schema_grants = global_grants | direct[SOURCE + '.*']
    if ('ALL PRIVILEGES' not in schema_grants and not {'TRIGGER', 'EVENT'} <= schema_grants
            or not {'ALL PRIVILEGES', 'SHOW_ROUTINE', 'SELECT'} & global_grants):
        raise SafetyError('La cuenta debe poder verificar disparadores, rutinas y eventos mediante permisos directos.')


def inspect_source(connection):
    origin = identity(connection)
    assert_source(origin)
    entries = objects(connection)
    tables = [name for name, kind in entries if kind == 'BASE TABLE']
    views = tuple(name for name, kind in entries if kind == 'VIEW')
    if len(tables) != 26 or views != VIEWS or len(entries) != 30:
        raise SafetyError('El inventario no coincide con las 26 tablas y cuatro vistas esperadas.')
    if any(not re.fullmatch(r'[a-zA-Z0-9_]+', name) for name, _ in entries):
        raise SafetyError('Hay nombres de objetos sin soporte en este procedimiento.')
    definitions = view_definitions(connection)
    if tuple(name for name, definition, _, _ in definitions if definition) != VIEWS:
        raise SafetyError('Falta acceso a una o más definiciones de vistas.')
    check_aux_visibility([grant for grant, in rows(connection, 'SHOW GRANTS')])
    auxiliary = rows(connection, '''
        SELECT
          (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema=DATABASE()),
          (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE()),
          (SELECT COUNT(*) FROM information_schema.events WHERE event_schema=DATABASE())
    ''')[0]
    if any(auxiliary):
        raise SafetyError('Hay disparadores, procedimientos, funciones o eventos fuera del alcance del respaldo.')
    engines = rows(connection, '''
        SELECT ENGINE FROM information_schema.tables
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'
    ''')
    if len(engines) != len(tables) or any(engine != 'InnoDB' for engine, in engines):
        raise SafetyError('El respaldo consistente requiere que todas las tablas sean InnoDB.')
    return origin, tables, definitions


def replace_schema(text, schema, replacement):
    return text.replace(f'`{schema}`.', f'`{replacement}`.')


def snapshot(connection, tables, definitions, schema):
    result = {}
    for name in (*tables, *VIEWS):
        records = rows(connection, f'SELECT * FROM `{name}`')
        hashes = sorted(hashlib.sha256(repr(record).encode()).digest() for record in records)
        result[name] = [len(records), hashlib.sha256(b''.join(hashes)).hexdigest()]
    ddl = {}
    for table in tables:
        definition = rows(connection, f'SHOW CREATE TABLE `{table}`')[0][1]
        ddl[table] = replace_schema(definition, schema, 'BASE')
    return {
        'rows': result, 'tables': ddl,
        'views': [[name, replace_schema(sql, schema, 'BASE'), security, check]
                  for name, sql, security, check in definitions],
    }


def verify_snapshot(connection, manifest):
    expected = manifest['snapshot']
    entries = set(objects(connection))
    if entries != ({(name, 'BASE TABLE') for name in expected['tables']}
                   | {(name, 'VIEW') for name in VIEWS}):
        raise SafetyError('La restauración está incompleta o contiene objetos inesperados.')
    if snapshot(connection, expected['tables'], view_definitions(connection), TARGET) != expected:
        raise SafetyError('Las estructuras, definiciones o datos restaurados no coinciden con el origen.')


def mysql_option(value):
    value = str(value).replace('\\', '\\\\').replace('"', '\\"')
    value = value.replace('\r', '\\r').replace('\n', '\\n').replace('\t', '\\t')
    return '"' + value + '"'


def mysql_cli(folder, program, arguments, credentials, *, stdin=None, protocol='TCP', shared=None):
    option = folder / f'cliente-{secrets.token_hex(12)}.cnf'
    options = {'user': credentials['user'], 'password': credentials['password']}
    with option.open('x', encoding='utf-8', newline='\n') as stream:
        stream.write('[client]\n' + ''.join(f'{k}={mysql_option(v)}\n' for k, v in options.items()))
    try:
        check_private(option)
        destination = ([f'--host={credentials["host"]}', f'--port={credentials["port"]}']
                       if protocol == 'TCP' else [f'--shared-memory-base-name={shared}'])
        command = [
            str(BIN / f'{program}.exe'), f'--defaults-file={option}', '--no-login-paths',
            f'--protocol={protocol}', *destination, '--default-character-set=utf8mb4', *arguments,
        ]
        env = {key: value for key, value in os.environ.items()
               if not key.upper().startswith('MYSQL_')}
        return subprocess.run(command, env=env, stdin=stdin or subprocess.DEVNULL,
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              timeout=120, check=False)
    finally:
        option.unlink()


def validate():
    with pymysql.connect(**source_args()) as origin:
        rows(origin, 'START TRANSACTION READ ONLY')
        _, tables, definitions = inspect_source(origin)
        for name in (*tables, *VIEWS):
            rows(origin, f'SELECT * FROM `{name}` LIMIT 0')
        origin.rollback()
    print(f'Validación de solo lectura correcta: {len(tables)} tablas y {len(definitions)} vistas.')


def backup():
    params = source_args()
    with pymysql.connect(**params) as connection:
        rows(connection, 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
        origin, tables, definitions = inspect_source(connection)
        expected = snapshot(connection, tables, definitions, SOURCE)
        connection.rollback()
    folder = private_workspace()
    print(f'Carpeta privada: {folder}', flush=True)
    result = mysql_cli(folder, 'mysqldump', [
        '--single-transaction', '--no-tablespaces', '--skip-add-drop-table',
        '--skip-add-locks', '--skip-disable-keys', '--skip-triggers',
        '--set-gtid-purged=OFF', '--column-statistics=0',
        f'--result-file={folder / ARTIFACTS[0]}',
        *(f'--ignore-table={SOURCE}.{view}' for view in VIEWS), SOURCE,
    ], params)
    if result.returncode:
        raise SafetyError(f'El respaldo terminó con código {result.returncode}.')
    write_json(folder, ARTIFACTS[1], definitions)
    with pymysql.connect(**params) as connection:
        rows(connection, 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
        current, current_tables, current_views = inspect_source(connection)
        if current != origin or snapshot(connection, current_tables, current_views, SOURCE) != expected:
            raise SafetyError('El origen cambió durante el respaldo. Repite la captura.')
        connection.rollback()
    write_json(folder, 'respaldo.json', {
        'origin': origin, 'snapshot': expected,
        'files': {name: file_hash(private_file(folder, name)) for name in ARTIFACTS},
    })
    print('Respaldo completo de tablas y vistas. La instancia aislada aún no se ha preparado.')


def verified_backup(folder):
    path = private_file(folder, 'respaldo.json')
    manifest = json.loads(path.read_text(encoding='utf-8'))
    assert_source(manifest['origin'])
    if (len(manifest['snapshot']['tables']) != 26
            or tuple(item[0] for item in manifest['snapshot']['views']) != VIEWS
            or set(manifest['files']) != set(ARTIFACTS)
            or any(file_hash(private_file(folder, name)) != manifest['files'][name] for name in ARTIFACTS)):
        raise SafetyError('El manifiesto o los archivos del respaldo no están íntegros.')
    return manifest, file_hash(path)


def assert_free_port():
    with socket.socket() as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        probe.bind(('127.0.0.1', PORT))


def await_server(process, probe):
    for _ in range(60):
        if process.poll() is not None:
            break
        result = probe()
        if result:
            return result
        time.sleep(1)
    raise SafetyError('La instancia aislada no alcanzó el estado esperado.')


def mysql_server(folder):
    return [
        str(BIN / 'mysqld.exe'), '--no-defaults', f'--basedir={BIN.parent}',
        f'--datadir={folder / "data"}', '--mysqlx=OFF', '--named-pipe=OFF',
        '--skip-log-bin', '--event-scheduler=OFF', '--secure-file-priv=NULL',
        '--general-log=OFF', '--slow-query-log=OFF', '--console',
    ]


def bootstrap_offline(folder, command, password):
    shared = 'TOCO_' + secrets.token_hex(12)
    init = folder / 'inicio-privado.sql'
    with init.open('x', encoding='ascii') as stream:
        stream.write(f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{password}';\n")
    process = None
    try:
        check_private(init)
        process = subprocess.Popen([
            *command, '--skip-networking', '--shared-memory',
            f'--shared-memory-base-name={shared}', f'--init-file={init}',
        ], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
           creationflags=DETACHED)
        root = target_args(password, None)

        def authenticate():
            result = mysql_cli(folder, 'mysql', [
                '--connect-timeout=2', '--batch', '--skip-column-names',
                '--execute=SELECT @@server_uuid, @@datadir, @@version',
            ], root, protocol='MEMORY', shared=shared)
            if result.returncode:
                return None
            uuid, data, version = result.stdout.decode().strip().split('\t')
            if uuid == SOURCE_UUID or Path(data).resolve() != folder / 'data' or version != VERSION:
                raise SafetyError('No se pudo confirmar la identidad del arranque sin red.')
            return uuid

        uuid = await_server(process, authenticate)
        result = mysql_cli(folder, 'mysql', ['--execute=SHUTDOWN'], root,
                           protocol='MEMORY', shared=shared)
        if result.returncode:
            raise SafetyError('No se pudo cerrar el arranque aislado sin red.')
        if process.wait(timeout=30) != 0:
            raise SafetyError('El arranque aislado sin red terminó con un error.')
        return uuid
    finally:
        if process is not None and process.poll() is None:
            process.terminate()
            process.wait(timeout=15)
        init.unlink()


def prepare(folder):
    verified_backup(folder)
    if any((folder / name).exists() for name in ('data', 'conexion.json', 'restauracion-verificada.json')):
        raise SafetyError('La carpeta ya tiene una preparación. Utiliza una copia privada nueva del respaldo.')
    assert_free_port()
    command = mysql_server(folder)
    subprocess.run([*command, '--initialize-insecure', '--skip-networking'],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=120)
    password = secrets.token_urlsafe(32)
    uuid = bootstrap_offline(folder, command, password)
    assert_free_port()
    # Esta ruta solo es alcanzable tras autenticar root con contraseña sin red y apagar el arranque.
    with (folder / 'mysql.log').open('xb') as log:
        process = subprocess.Popen([
            *command, '--bind-address=127.0.0.1', f'--port={PORT}', '--shared-memory=OFF',
        ], stdin=subprocess.DEVNULL, stdout=log, stderr=log, creationflags=DETACHED)

    def connect():
        try:
            return pymysql.connect(**target_args(password, None))
        except pymysql.err.OperationalError:
            return None

    try:
        with await_server(process, connect) as target:
            assert_isolated(identity(target), folder, uuid, None)
            rows(target, f'CREATE DATABASE `{TARGET}` CHARACTER SET utf8mb4')
        write_json(folder, 'conexion.json', {
            'password': password, 'uuid': uuid, 'certificate_key': secrets.token_hex(32),
        })
    except Exception:
        if process.poll() is None:
            process.terminate()
        raise
    print(f'Instancia preparada: {TARGET} en 127.0.0.1:{PORT}. UUID {uuid}. Base vacía.')


def sign_certificate(payload, secret):
    data = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    return hmac.new(bytes.fromhex(secret), data, hashlib.sha256).hexdigest()


def certificate_payload(actual, manifest_hash):
    return {'target': actual, 'backup_manifest_sha256': manifest_hash, 'migration_sha256': file_hash(MIGRATION)}


def restore_gate(actual):
    def hex_sql(value):
        return "CONVERT(X'" + value.encode('utf-8').hex() + "' USING utf8mb4)"

    datadir = Path(actual['datadir']).as_posix().rstrip('/').lower()
    return (
        "DO CASE WHEN DATABASE()=" + hex_sql(TARGET)
        + f" AND @@port={PORT} AND @@server_uuid=" + hex_sql(actual['uuid'])
        + " AND TRIM(TRAILING '/' FROM LOWER(REPLACE(@@datadir,CHAR(92),'/')))=" + hex_sql(datadir)
        + " THEN 1 ELSE (SELECT 1 UNION ALL SELECT 2) END"
    )


def restore(folder):
    manifest, manifest_hash = verified_backup(folder)
    meta = read_json(folder, 'conexion.json')
    if (folder / 'restauracion-verificada.json').exists():
        raise SafetyError('Ya existe una constancia de restauración en esta carpeta.')
    credentials = target_args(meta['password'])
    with pymysql.connect(**credentials) as target:
        actual = identity(target)
        assert_isolated(actual, folder, meta['uuid'])
        if objects(target):
            raise SafetyError('La base aislada debe estar vacía antes de restaurar.')
    with private_file(folder, ARTIFACTS[0]).open('rb') as stream:
        result = mysql_cli(folder, 'mysql', [
            f'--database={TARGET}', '--skip-reconnect', f'--init-command={restore_gate(actual)}',
        ], credentials, stdin=stream)
        if result.returncode:
            raise SafetyError(f'La importación terminó con código {result.returncode}.')
    with pymysql.connect(**credentials) as target:
        assert_isolated(identity(target), folder, meta['uuid'])
        for name, definition, security, check in read_json(folder, ARTIFACTS[1]):
            if name not in VIEWS or security not in ('DEFINER', 'INVOKER'):
                raise SafetyError('Definición de vista inesperada.')
            body = replace_schema(definition, SOURCE, TARGET)
            option = f' WITH {check} CHECK OPTION' if check in ('LOCAL', 'CASCADED') else ''
            rows(target, f'CREATE SQL SECURITY {security} VIEW `{name}` AS {body}{option}')
        rows(target, 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
        verify_snapshot(target, manifest)
        target.rollback()
    if verified_backup(folder)[1] != manifest_hash:
        raise SafetyError('El respaldo cambió durante la restauración.')
    payload = certificate_payload(actual, manifest_hash)
    write_json(folder, 'restauracion-verificada.json', {
        'payload': payload, 'signature': sign_certificate(payload, meta['certificate_key']),
    })
    print(f'Restauración verificada en {TARGET}. UUID aislado: {meta["uuid"]}.')


def verify_certificate(certificate, actual, manifest_hash, key):
    payload = certificate.get('payload')
    signature = certificate.get('signature')
    if (payload != certificate_payload(actual, manifest_hash) or not isinstance(signature, str)
            or not hmac.compare_digest(signature, sign_certificate(payload, key))):
        raise SafetyError('La constancia es inválida para el respaldo, la migración o la instancia.')


def migrate(folder, confirmed_uuid):
    manifest, manifest_hash = verified_backup(folder)
    meta = read_json(folder, 'conexion.json')
    if not confirmed_uuid or confirmed_uuid != meta['uuid'] or confirmed_uuid == SOURCE_UUID:
        raise SafetyError('La migración requiere confirmar el UUID aislado.')
    certificate = read_json(folder, 'restauracion-verificada.json')
    with pymysql.connect(**target_args(meta['password'])) as target:
        actual = identity(target)
        assert_isolated(actual, folder, confirmed_uuid)
        verify_certificate(certificate, actual, manifest_hash, meta['certificate_key'])
        rows(target, 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
        verify_snapshot(target, manifest)
        unique = rows(target, "SHOW INDEX FROM movimientos_material WHERE Key_name='uq_mm_detalle_compra'")
        if len(unique) != 1 or unique[0][1] != 0 or unique[0][4] != 'id_detalle_compra':
            raise SafetyError('No se verificó la unicidad de las recepciones.')
        target.rollback()
        migration = MIGRATION.read_bytes()
        if not hmac.compare_digest(hashlib.sha256(migration).hexdigest(),
                                   certificate['payload']['migration_sha256']):
            raise SafetyError('El archivo de migración cambió después de validar la constancia.')
        statements = '\n'.join(line for line in migration.decode('utf-8').splitlines()
                               if not line.lstrip().startswith('--'))
        assert_isolated(identity(target), folder, confirmed_uuid)
        for statement in statements.split(';'):
            if statement.strip():
                rows(target, statement)
        columns = rows(target, '''
            SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.columns
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('compras','compra_detalles')
        ''')
        if not {('compras', 'id_orden_produccion'), ('compras', 'revision'),
                ('compra_detalles', 'factor_presentacion')} <= set(columns):
            raise SafetyError('La verificación de columnas de la migración no coincidió.')
        index = rows(target, "SHOW INDEX FROM compras WHERE Key_name='uq_compras_clave_solicitud'")
        if len(index) != 1 or index[0][1] != 0 or index[0][4] != 'clave_solicitud':
            raise SafetyError('La verificación de la clave de solicitud no coincidió.')
    print(f'Migración aplicada exclusivamente en {TARGET}, puerto {PORT}.')


def main():
    parser = argparse.ArgumentParser()
    stage = parser.add_mutually_exclusive_group(required=True)
    stage.add_argument('--validar', action='store_true')
    stage.add_argument('--respaldar', action='store_true')
    stage.add_argument('--preparar', type=Path)
    stage.add_argument('--restaurar', type=Path)
    stage.add_argument('--migrar', type=Path)
    parser.add_argument('--confirmar-migracion', metavar='UUID_AISLADO')
    parser.add_argument('--puerto-aislado', type=int, choices=(33317, 33318))
    args = parser.parse_args()
    if args.puerto_aislado is not None:
        if args.validar or args.respaldar:
            parser.error('--puerto-aislado solo corresponde a preparar, restaurar o migrar')
        usar_puerto_aislado(args.puerto_aislado)
    if args.confirmar_migracion and not args.migrar:
        parser.error('--confirmar-migracion solo corresponde a --migrar')
    if args.validar:
        validate()
    elif args.respaldar:
        backup()
    elif args.preparar:
        prepare(workspace(args.preparar))
    elif args.restaurar:
        restore(workspace(args.restaurar))
    else:
        migrate(workspace(args.migrar), args.confirmar_migracion)


if __name__ == '__main__':
    try:
        main()
    except SafetyError as error:
        raise SystemExit(f'Operación detenida: {error}') from None
    except Exception as error:
        # Los errores de bibliotecas y subprocesos pueden incluir argumentos privados.
        raise SystemExit(f'Operación detenida: {type(error).__name__}. No se muestran detalles privados.') from None
