# TodoApp-GraphQL-API
A GraphQL based API for Todo app.

A simple API for Todo App based on NodeJS & Apollo Server.

### Steps to install

1. Clone the repo.

2. Install the deps using 

      `npm i`

3. Create a MongoDB cluster on MongoDB Atlas or setup your local instance of MongoDB.

4. Create a `.env` file and put your DB connect string main JWT token secret as `DB_URI` and `SECRET` respoectively.

5. Run the server using `dev` or `start` npm scripts.

      `dev` uses nodemon - listens for changes in code and estarts server.
      
      `start` is a one-time server starting script.
