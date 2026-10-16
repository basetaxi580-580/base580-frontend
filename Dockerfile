FROM node:24.15.0-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
ENV BACKEND_URL=http://backend:8080
ENV NGINX_ENVSUBST_FILTER=^BACKEND_URL$
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/base580-frontend/browser /usr/share/nginx/html
EXPOSE 80
