# Base580 frontend

Aplicacion Angular independiente. Consume el contrato REST del backend mediante
/api; no necesita codigo fuente Java para compilar ni desplegar.

## Desarrollo

Requiere Node 24 y backend iniciado en el puerto 8080.

```bash
npm ci
npm start
```

Abre http://localhost:4200. proxy.conf.json reenvia /api/** al backend local.
Los entornos de desarrollo y produccion utilizan la ruta relativa /api.

## Produccion

```bash
npm run build
docker build -t base580-frontend:latest .
```

La imagen sirve archivos con Nginx y reenvia /api/ al servidor BACKEND_URL
(por defecto http://backend:8080, sin barra final). Se configura al iniciar el
contenedor, sin recompilar Angular. El DNS de Docker permite seguir al backend
cuando se reemplaza su contenedor.

/healthz comprueba Nginx; /api/state comprueba la conexion con la API.

Al hacer push a main, el workflow actualiza este clon en la VM y llama al script
de base580-infra para construir y reemplazar solo el frontend. Consulta su README
para preparar la VM, las imagenes iniciales y los secretos SSH.

## Pruebas

```bash
npm test -- --watch=false
```
