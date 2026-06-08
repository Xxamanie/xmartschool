FROM node:lts-alpine AS base
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install
COPY . .

FROM base AS dev
ENV NODE_ENV=development
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM base AS build
ENV NODE_ENV=production
# VITE_* vars must be present at build time — Vite bakes them into the bundle
ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_STORAGE_BUCKET
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_STORAGE_BUCKET=$VITE_SUPABASE_STORAGE_BUCKET
RUN npm run build

FROM node:lts-alpine AS production
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
