"""Agrega cuentas administrativas de demostracion en modo solo lectura.

Revision ID: 20260719_cuenta_demo_readonly
Revises: 20260714_taller_tickets_fix
Create Date: 2026-07-19
"""

from alembic import op


revision = "20260719_cuenta_demo_readonly"
down_revision = "20260714_taller_tickets_fix"
branch_labels = None
depends_on = None


DEMO_EMAIL = "demo.entrevista@innovamobili.com"
# Hash scrypt de una clave aleatoria entregada de forma privada al propietario.
# No se guarda la clave en texto plano dentro del repositorio.
DEMO_PASSWORD_HASH = (
    "scrypt:32768:8:1$VMJCXXVTXrtsI9x8$"
    "ec4014192766115e6d4570da03542041feb35051db8aba5457fddca94e99e8b3"
    "23d13ba88504e51660806c342b9d40b982ae1d0fe8ee5be895f9f9f47157e131"
)


def upgrade():
    op.execute("""
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS solo_lectura BOOLEAN NOT NULL DEFAULT FALSE;
    """)

    # Si el correo ya se preparo manualmente, lo convertimos de manera segura
    # en cuenta demo. En una base nueva/heredada lo insertamos una sola vez.
    op.execute(f"""
        UPDATE usuarios
        SET nombre = 'Demo Entrevista',
            password_hash = '{DEMO_PASSWORD_HASH}',
            pin_acceso = '',
            contrasena = '',
            rol = 'Admin',
            area_asignada = 'GENERAL',
            estado = TRUE,
            solo_lectura = TRUE
        WHERE LOWER(email) = LOWER('{DEMO_EMAIL}');

        INSERT INTO usuarios (
            nombre, email, pin_acceso, contrasena, password_hash, rol,
            area_asignada, empresa_nombre, empresa_ruc, telefono, estado,
            solo_lectura
        )
        SELECT
            'Demo Entrevista', '{DEMO_EMAIL}', '', '', '{DEMO_PASSWORD_HASH}',
            'Admin', 'GENERAL', 'INNOVA MOBILI S.A.C.', '20600768175', NULL,
            TRUE, TRUE
        WHERE NOT EXISTS (
            SELECT 1 FROM usuarios WHERE LOWER(email) = LOWER('{DEMO_EMAIL}')
        );
    """)


def downgrade():
    # No eliminamos la cuenta ni la columna para evitar una perdida accidental
    # de configuracion de usuarios al revertir otras migraciones.
    pass
