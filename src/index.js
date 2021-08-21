import {
    ApolloServer,
    gql
} from 'apollo-server';
import {
    MongoClient
} from 'mongodb';
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

// env variables
dotenv.config()
const {
    DB_URI,
    DB_NAME
} = process.env;


// Graphql typeDefs and resolvers
const resolvers = {

    Query: {
        myTaskList: () => []
    },

    Mutation: {
        signup: async(_, { input }, { db }) => {
            const hashedPassword = bcrypt.hashSync(input.password)
            const user = {...input, password: hashedPassword }
            await db.collection('Users').insertOne(user)
            return {
                user,
                token: 'token'
            }
        },

        signin: async(_, { input }, { db }) => {
            const user = await db.collection('Users').findOne({ email: input.email })
            if (user) {
                const isMatch = bcrypt.compareSync(input.password, user.password)
                if (isMatch) {
                    return {
                        user,
                        token: 'token'
                    }
                } else
                    throw new Error("Invalid credentials")

            } else
                throw new Error("Invalid credentials")

        }
    },

    User: {
        id: ({ _id, id }) => _id || id
    }

};

const typeDefs = gql `
type User{
    id:ID!
    name:String!
    email:String!
    avatar:String!
}
type Task{
    id:ID!
    createdAt:String!
    title:String!
    progress:Float!
    users:[User!]!
    todos:[Todo!]!
}

type Todo{
    id:ID!
    content:String!
    isCompleted:Boolean!
    task:Task!
}

type AuthUser{
    user:User!
    token:String!
}

type Query{
    myTaskList:[Task!]!
}

input SignupInput{
    name:String!
    email:String!
    password:String!
    avatar:String
}

input SigninInput{
    email:String!
    password:String!
}

type Mutation{
    signup(input:SignupInput):AuthUser!
    signin(input:SigninInput):AuthUser!
}
`;


// mongodb config
const serverStartup = async() => {
    const client = new MongoClient(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    await client.connect();
    const db = client.db(DB_NAME)
    db.collection("Users").createIndex({ "email": 1 }, { unique: true })


    const dbContext = {
        db,
    }

    // create server object
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: dbContext
    })

    //start server to listen for requests
    server.listen().then(({
        url
    }) => {
        console.log(`Serving at ${url}`);
    })
}

serverStartup()