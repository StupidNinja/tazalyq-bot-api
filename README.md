# NestJS Project

## Prerequisites

You need to have NVM (Node Version Manager) on your local machine.

## Installation

```bash
# install required version of node
$ nvm install

# installs dependencies from package-lock.json
$ npm ci
```

## Running the app

```bash
# select required version of node
$ nvm use

# run app in watch mode
$ npm run start:dev
```

## Test

```bash
# unit tests
$ npm run test

# test coverage
$ npm run test:cov

# e2e tests
$ npm run test:e2e
```

## Database scripts

```bash
# runs new migrations
$ npm run migration:run

# reverts last migration
$ npm run migration:revert

# deletes all tables and content in database
$ npm run database:clear

# populates database with seed data
$ npm run database:seed

# clears database, runs migrations and populates with seeds
$ npm run database:reset

# creates new migrations file
$ npm run typeorm migration:create -n database/migrations/<migration-file-name>
```
