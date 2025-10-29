# Usar una imagen base de Node.js
FROM node:18-alpine

# Crear el directorio de la aplicación en el contenedor
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalar dependencias
RUN npm install

# --- Copiar explícitamente los archivos de la app ---
COPY index.js .
COPY index.html .
COPY style.css .
COPY script.js .

# Copiar la carpeta de imágenes recursivamente
COPY img/ ./img/

# Comando para iniciar la aplicación
CMD [ "npm", "start" ]