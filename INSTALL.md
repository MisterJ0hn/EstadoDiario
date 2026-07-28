# Manual de Instalación - Estado Diario CRM

## Requisitos Previos

- **Docker** >= 24.0
- **Docker Compose** >= 2.20
- **Git**

## Instalación Rápida

```bash
# 1. Clonar el repositorio
cd C:\sitios\temposoft\estado_diario

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Editar .env si es necesario (passwords, puertos, etc.)

# 4. Levantar todos los servicios
docker-compose up -d --build

# 5. Verificar que los servicios estén corriendo
docker-compose ps
```

## Servicios y Puertos

| Servicio   | Puerto | URL                          |
|------------|--------|------------------------------|
| Frontend   | 8090   | http://localhost:8090         |
| Backend    | 8091   | http://localhost:8091         |
| Swagger    | 8091   | http://localhost:8091/docs    |
| ReDoc      | 8091   | http://localhost:8091/redoc   |
| pgAdmin    | 5050   | http://localhost:5050         |
| PostgreSQL | 5432   | localhost:5432                |

## Credenciales por Defecto

### Aplicación
- **Admin**: usuario `admin`, password `admin123`
- **Usuario**: usuario `usuario`, password `usuario123`

### pgAdmin
- **Email**: admin@estadodiario.cl
- **Password**: admin123

### PostgreSQL
- **Host**: postgres (dentro de Docker) / localhost (desde el host)
- **Puerto**: 5432
- **Base de datos**: estado_diario_db
- **Usuario**: estado_diario_user
- **Password**: dev_password_2024

## Configurar pgAdmin

1. Acceder a http://localhost:5050
2. Iniciar sesión con las credenciales de pgAdmin
3. Clic derecho en "Servers" > "Register" > "Server..."
4. **General**: Name = `Estado Diario`
5. **Connection**:
   - Host: `postgres`
   - Port: `5432`
   - Maintenance database: `estado_diario_db`
   - Username: `estado_diario_user`
   - Password: `dev_password_2024`
6. Guardar

## Datos Iniciales (Seeds)

Al iniciar el backend, se crean automáticamente:
- Usuario administrador (admin/admin123)
- Usuario demo (usuario/usuario123)
- 9 jurisdicciones predefinidas (Civil, Familia, Laboral, Penal, etc.)

## Desarrollo Local (sin Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8091
```

### Frontend
```bash
cd frontend
npm install
npm start
# Acceder en http://localhost:4200
```

## Comandos Útiles

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend

# Reiniciar un servicio
docker-compose restart backend

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (BORRA LA BD)
docker-compose down -v

# Reconstruir un servicio
docker-compose up -d --build backend
```
