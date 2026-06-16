# Stage 1: React Build
FROM node:20-alpine AS builder

# Ensure devDependencies (vite, tailwind, etc.) are installed regardless of host NODE_ENV
ENV NODE_ENV=development

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Nginx
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
