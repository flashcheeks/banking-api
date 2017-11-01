# Banking API

## Requirements

- Node.js installed globally on your machine
- Serverless installed globally on your machine


## Usage

This is a [Serverless](https://serverless.com/) app for AWS Lambda. 

Copy `.env.sample.yml` to `.env.yml` and fill in the values.

For Lambda, `handler.js` handles core requests and passes them to the main app in `app/index.js`. You can run this locally as follows:

    $ serverless offline start

