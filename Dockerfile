FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=8787
EXPOSE 8787
CMD ["npm", "start"]
