FROM node:18-alpine3.15

WORKDIR /nodeBackend
COPY . .
RUN yarn install --production
RUN npm install -g npm@latest

CMD ["npm", "run", "prod"]