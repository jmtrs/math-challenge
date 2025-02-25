# Usa la imagen base de Node.js
FROM node:14

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de tu aplicación Node.js
COPY package*.json ./
RUN npm install

# Copia el código de la aplicación
COPY . .

# Expone el puerto (opcional, Docker lo hace automáticamente en Railway)
EXPOSE 3000

# Inicia la aplicación
CMD ["node", "index.js"]
