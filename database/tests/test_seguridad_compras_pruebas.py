import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch


loader = importlib.util.spec_from_file_location(
    'preparar_compras_pruebas', Path(__file__).resolve().parents[1] / 'preparar_compras_pruebas.py'
)
script = importlib.util.module_from_spec(loader)
loader.loader.exec_module(script)


class SeguridadComprasTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.folder = Path(temporary.name).resolve()
        self.uuid = 'e43fa3eb-7d72-4350-be18-160f028beee3'
        self.key = '00' * 32
        self.target = dict(database=script.TARGET, port=script.PORT, uuid=self.uuid,
                           datadir=str(self.folder / 'data'), version=script.VERSION)

    def test_no_fallback_without_credentials(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(script, 'dotenv_values') as reader:
            with self.assertRaisesRegex(script.SafetyError, 'TOCO_MYSQL_BACKUP_ENV'):
                script.source_args()
            reader.assert_not_called()

    def test_rejects_private_file_under_repository(self):
        with patch.dict(os.environ, {'TOCO_MYSQL_BACKUP_ENV': str(script.ROOT / '.env')}):
            with self.assertRaisesRegex(script.SafetyError, 'fuera del repositorio'):
                script.source_args()

    def test_source_requires_exact_database_port_uuid_and_version(self):
        origin = dict(database=script.SOURCE, port=script.SOURCE_PORT, uuid=script.SOURCE_UUID,
                      datadir=str(self.folder / 'principal'), version=script.VERSION)
        script.assert_source(origin)
        for changes in ({'port': 33317}, {'database': script.TARGET},
                        {'uuid': self.uuid}, {'version': '8.4.7'}):
            with self.subTest(changes=changes), self.assertRaises(script.SafetyError):
                script.assert_source(dict(origin, **changes))

    def test_target_rejects_main_wrong_database_uuid_port_path_and_version(self):
        script.assert_isolated(self.target, self.folder, self.uuid)
        for changes in (
            {'port': 3306}, {'database': script.SOURCE}, {'uuid': script.SOURCE_UUID},
            {'uuid': 'otro'}, {'datadir': str(self.folder / 'otra-instancia')}, {'version': '8.4.7'},
        ):
            with self.subTest(changes=changes), self.assertRaises(script.SafetyError):
                script.assert_isolated(dict(self.target, **changes), self.folder, self.uuid)

    def test_second_isolated_port_remains_exclusive(self):
        self.addCleanup(script.usar_puerto_aislado, script.PORT)
        with self.assertRaises(script.SafetyError):
            script.usar_puerto_aislado(3306)
        script.usar_puerto_aislado(33318)
        with self.assertRaises(script.SafetyError):
            script.assert_isolated(self.target, self.folder, self.uuid)
        script.assert_isolated(dict(self.target, port=33318), self.folder, self.uuid)

    def test_auxiliary_visibility_is_required(self):
        script.check_aux_visibility(['GRANT ALL PRIVILEGES ON *.* TO local'])
        script.check_aux_visibility([
            'GRANT SHOW_ROUTINE ON *.* TO local',
            'GRANT SELECT, TRIGGER, EVENT ON `toco_madera`.* TO local',
        ])
        with self.assertRaises(script.SafetyError):
            script.check_aux_visibility(['GRANT SELECT, SHOW VIEW ON `toco_madera`.* TO local'])
        with self.assertRaises(script.SafetyError):
            script.check_aux_visibility([
                'GRANT ALL PRIVILEGES ON *.* TO local',
                'REVOKE EVENT ON `toco_madera`.* FROM local',
            ])

    def test_incomplete_restore_fails_before_looking_at_rows(self):
        manifest = {'snapshot': {'tables': {'compras': 'estructura'}}}
        with patch.object(script, 'objects', return_value=[('compras', 'BASE TABLE')]), \
             patch.object(script, 'snapshot') as snapshot:
            with self.assertRaisesRegex(script.SafetyError, 'incompleta'):
                script.verify_snapshot(object(), manifest)
            snapshot.assert_not_called()

    def test_incomplete_restore_never_writes_certificate(self):
        meta = {'uuid': self.uuid, 'password': 'fixture', 'certificate_key': self.key}
        dump = self.folder / script.ARTIFACTS[0]
        dump.write_bytes(b'fixture')
        connection = MagicMock()
        with patch.object(script, 'verified_backup', return_value=({}, 'manifest')), \
             patch.object(script, 'read_json', side_effect=[meta, []]), \
             patch.object(script.pymysql, 'connect', return_value=connection), \
             patch.object(script, 'identity', return_value=self.target), \
             patch.object(script, 'objects', return_value=[]), \
             patch.object(script, 'private_file', return_value=dump), \
             patch.object(script, 'mysql_cli', return_value=MagicMock(returncode=0)), \
             patch.object(script, 'rows'), \
             patch.object(script, 'verify_snapshot', side_effect=script.SafetyError('incompleta')), \
             patch.object(script, 'write_json') as writer:
            with self.assertRaisesRegex(script.SafetyError, 'incompleta'):
                script.restore(self.folder)
            writer.assert_not_called()

    def test_certificate_binds_signature_instance_and_backup(self):
        payload = script.certificate_payload(self.target, 'manifest')
        certificate = {'payload': payload, 'signature': script.sign_certificate(payload, self.key)}
        script.verify_certificate(certificate, self.target, 'manifest', self.key)
        for altered, target, manifest, key in (
            ({**certificate, 'signature': 'invalida'}, self.target, 'manifest', self.key),
            (certificate, dict(self.target, uuid='otra'), 'manifest', self.key),
            (certificate, self.target, 'otro', self.key),
            (certificate, self.target, 'manifest', '11' * 32),
        ):
            with self.assertRaises(script.SafetyError):
                script.verify_certificate(altered, target, manifest, key)

    def test_migration_rejects_missing_confirmation_without_connecting(self):
        with patch.object(script, 'verified_backup', return_value=({}, 'manifest')), \
             patch.object(script, 'read_json', return_value={'uuid': self.uuid}), \
             patch.object(script.pymysql, 'connect') as connect:
            with self.assertRaisesRegex(script.SafetyError, 'confirmar el UUID'):
                script.migrate(self.folder, None)
            connect.assert_not_called()

    def test_migration_with_invalid_certificate_executes_no_sql(self):
        meta = {'uuid': self.uuid, 'password': 'fixture', 'certificate_key': self.key}
        with patch.object(script, 'verified_backup', return_value=({}, 'manifest')), \
             patch.object(script, 'read_json', side_effect=[meta, {}]), \
             patch.object(script.pymysql, 'connect') as connect, \
             patch.object(script, 'identity', return_value=self.target), \
             patch.object(script, 'rows') as sql:
            with self.assertRaisesRegex(script.SafetyError, 'constancia'):
                script.migrate(self.folder, self.uuid)
            connect.assert_called_once()
            sql.assert_not_called()

    def test_preparation_cannot_open_tcp_if_offline_bootstrap_fails(self):
        with patch.object(script, 'verified_backup'), patch.object(script, 'assert_free_port'), \
             patch.object(script.subprocess, 'run') as run, \
             patch.object(script.subprocess, 'Popen') as launch, \
             patch.object(script, 'bootstrap_offline', side_effect=script.SafetyError('sin red')):
            with self.assertRaisesRegex(script.SafetyError, 'sin red'):
                script.prepare(self.folder)
            self.assertIn('--skip-networking', run.call_args.args[0])
            launch.assert_not_called()

    def test_restore_gate_checks_database_port_uuid_and_directory(self):
        gate = script.restore_gate(self.target)
        self.assertIn('@@port=33317', gate)
        self.assertIn('@@server_uuid', gate)
        self.assertIn('@@datadir', gate)
        self.assertIn('DATABASE()', gate)
        self.assertNotIn('3306', gate)
