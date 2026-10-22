FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs logo.js ./
COPY index.html styles.css studio.js ./
COPY brand.png Vazirmatn.woff2 OFL.txt design-reference.html ./
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
EXPOSE 3000
CMD ["node", "server.mjs"]
