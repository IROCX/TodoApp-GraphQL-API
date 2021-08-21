import {
    ApolloServer,
    gql
} from 'apollo-server';
import {
    MongoClient,
    ObjectId

} from 'mongodb';
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// env variables
dotenv.config()
const {
    DB_URI,
    DB_NAME,
    SECRET
} = process.env;

const getToken = (user) => jwt.sign({ id: user._id }, SECRET, { expiresIn: 60 * 60 * 24 })
const getUserFromToken = async(token, db) => {
    if (!token) {
        console.log(1)
        return null
    }
    const { id } = jwt.verify(token, SECRET)
    if (!id) {
        console.log(2)
        return null
    }
    const user = await db.collection("Users").findOne({ _id: ObjectId(id) })
    return user
}



// Graphql typeDefs and resolvers
const resolvers = {

    Query: {
        myTaskList: () => []
    },

    Mutation: {
        signup: async(_, { input }, { db }) => {
            const hashedPassword = bcrypt.hashSync(input.password)
            const newUser = {...input, password: hashedPassword }
            await db.collection('Users').insertOne(newUser)
            return {
                newUser,
                token: getToken(newUser)
            }
        },

        signin: async(_, { input }, { db }) => {
            const user = await db.collection('Users').findOne({ email: input.email })
            const isMatch = bcrypt.compareSync(input.password, user ? user.password : "")
            if (user && isMatch)
                return {
                    user,
                    token: getToken(user)
                }
            else
                throw new Error("Invalid credentials")

        }
    },

    // _id to id mapper for DB User record
    User: {
        id: ({ _id, id }) => _id || id
    }


}

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

    // create server object
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: async({ req }) => {
            const user = await getUserFromToken(req.headers.authorization, db)
            return {
                db,
                user
            }
        }
    })

    //start server to listen for requests
    server.listen().then(({
        url
    }) => {
        console.log(`Serving at ${url}`);
    })
}

serverStartup()