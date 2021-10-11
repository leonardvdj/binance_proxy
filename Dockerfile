FROM node:16-alpine
WORKDIR /usr/src/app
COPY . .
RUN yarn install
EXPOSE 8080
ENTRYPOINT [ "node", "." ]