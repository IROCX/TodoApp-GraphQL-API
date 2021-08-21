import {ApolloServer, gql} from 'apollo-server';
import {MongoClient, ObjectId} from 'mongodb';
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

const getToken = (user) => jwt.sign({id: user._id}, SECRET, {expiresIn: 60 * 60 * 24})
const getUserFromToken = async (token, db) => {
    if (!token) return null
    const {id} = jwt.verify(token, SECRET)
    if (!id) return null
    return await db.collection("Users").findOne({_id: ObjectId(id)})
}


// Graphql typeDefs and resolvers
const resolvers = {

    Query: {
        myTaskList: async (_, __, {db, user}) => {
            if (!user) throw new Error("User not signed in. Please Sign In.")
            return await db.collection('Tasks').find({userIds: user._id}).toArray()
        },
        getTask: async (_, {id}, {
            db, user
        }) => {
            if (!user) throw new Error("User not signed in. Please Sign In.")
            return await db.collection('Tasks').findOne({_id: ObjectId(id)})
        }

    },

    Mutation: {
        signup: async (_, {input}, {db}) => {
            const hashedPassword = bcrypt.hashSync(input.password)
            const newUser = {...input, password: hashedPassword}
            await db.collection('Users').insertOne(newUser)
            return {
                user: newUser,
                token: getToken(newUser)
            }
        },

        signin: async (_, {input}, {db}) => {
            const user = await db.collection('Users').findOne({email: input.email})
            const isMatch = bcrypt.compareSync(input.password, user ? user.password : "")
            if (user && isMatch) {
                return {
                    user,
                    token: getToken(user)
                }
            } else
                throw new Error("Invalid credentials")

        },

        createTask: async (_, {title}, {db, user}) => {
            if (!user) throw new Error("User not authenticated. Please Sign in")
            const newTask = {
                title,
                createdAt: new Date().toISOString(),
                userIds: [user._id],
            }

             await db.collection('Tasks').insertOne(newTask)
            return newTask
        },
        updateTask: async (_, {id, title}, {db, user}) => {
            if (!user) throw new Error("User not authenticated. Please Sign in")
            const fetchedTask = await db.collection('Tasks').findOne({_id: ObjectId(id)})
            const isMember = fetchedTask.userIds.filter((id) => id.equals(user._id))
            if (isMember.length === 1) {
                await db.collection('Tasks').updateOne({_id: ObjectId(id)}, {$set: {title}})
                return await db.collection('Tasks').findOne({_id: ObjectId(id)})
            } else
                throw new Error("User not authorized. Only members can make changes to a Task.")
        },
        deleteTask: async (_, {id}, {db, user}) => {
            if (!user) throw new Error("User not authenticated. Please Sign in")
            const fetchedTask = await db.collection('Tasks').findOne({_id: ObjectId(id)})
            const isMember = fetchedTask.userIds.filter((id) => id.equals(user._id))
            if (isMember.length === 1) {
                await db.collection('Tasks').deleteOne({_id: ObjectId(id)})
                return true
            } else
                throw new Error("User not authorized. Only members can make changes to a Task.")
        },
        addUserToTask: async (_, {taskId, userId}, {db, user}) => {
            if (!user) throw new Error("User not authenticated. Please Sign in")
            const fetchedTask = await db.collection('Tasks').findOne({_id: ObjectId(taskId)})
            const isMember = fetchedTask.userIds.filter((id) => id.equals(user._id))
            if (isMember.length === 1) {
                await db.collection('Tasks').updateOne({_id: ObjectId(taskId)}, {
                    $addToSet: {
                        userIds: ObjectId(userId)
                    }
                })
                return await db.collection('Tasks').findOne({_id: ObjectId(taskId)})
            } else
                throw new Error("User not authorized. Only members can add user to a Task.")
        },


        createTodo: async (_, {content, taskId}, {db, user}) => {
            if (!user) throw new Error("User not authenticated. Please Sign in")
            const newTodo = {
                content,
                taskListId: taskId,
                isCompleted: false,
                createdBy: user._id
            }
            const fetchedTask = await db.collection('Tasks').findOne({
                _id: ObjectId(taskId)
            })
            const isMember = fetchedTask.userIds.filter((id) => id.equals(user._id))
            if (isMember.length === 1) {
                await db.collection('Todos').insertOne(newTodo)
                return newTodo
            } else
                throw new Error("User not authorized. Only members can add user to a Task.")
        },
        updateTodo: async (_, {id, content, isCompleted}, {db, user}) => {
            if (!user) throw new Error("User not authenticated. Please Sign in")
            const fetchedTodo = await db.collection('Todos').findOne({
                _id: ObjectId(id)
            })

            if (!fetchedTodo) throw new Error("Todo doesn't exists.")
            const fetchedTask = await db.collection('Tasks').findOne({
                _id: ObjectId(fetchedTodo.taskListId)
            })

            const isMember = fetchedTask.userIds.filter((id) => id.equals(user._id))
            if (isMember.length === 1) {
                await db.collection('Todos').updateOne({_id: ObjectId(id)}, {$set: {content, isCompleted}})

                return await db.collection('Todos').findOne({_id: ObjectId(id)})
            } else
                throw new Error("User not authorized. Only members can add user to a Task.")
        },
        deleteTodo: async (_, {id}, {db, user}) => {
            if (!user) throw new Error("User not authenticated. Please Sign in")
            const fetchedTodo = await db.collection('Todos').findOne({
                _id: ObjectId(id)
            })

            if (!fetchedTodo) throw new Error("Todo doesn't exists.")
            const fetchedTask = await db.collection('Tasks').findOne({
                _id: ObjectId(fetchedTodo.taskListId)
            })

            const isMember = fetchedTask.userIds.filter((id) => id.equals(user._id))
            if (isMember.length === 1) {
                await db.collection('Todos').deleteOne({_id: ObjectId(id)})
                return true
            } else
                throw new Error("User not authorized. Only members can add user to a Task.")
        }
    },


    // _id to id mapper for DB record
    User: {
        id: ({_id, id}) => _id || id
    },
    Task: {
        id: ({_id, id}) => _id || id,
        progress: async ({_id, id}, _, {db}) => {
            // console.log(_id)
            const res = await db.collection('Todos').find({taskListId: _id.toString()}).toArray()
            const completed = res.reduce((count, todo) => todo.isCompleted ? ++count : count, 0);
            if (res.length !== 0) {
                return Math.round((completed * 100) / res.length,)
            } else {
                return 0
            }
        },
        users: async ({userIds}, _, {db}) => {
            return Promise.all(
                userIds.map((userId) =>
                    db.collection('Users').findOne({
                        _id: userId
                    })
                )
            )
        },
        todos: async ({_id}, _, {db}) => {
            return db.collection('Todos').find({taskListId: _id.toString()}).toArray()
        }
    },
    Todo: {
        id: ({_id, id}) => _id || id,

        task: async ({taskListId}, _, {db}) => {
            console.log(await db.collection('Tasks').findOne({_id: taskListId}))
            return await db.collection('Tasks').findOne({_id: ObjectId(taskListId)})
        }

    },
}

const typeDefs = gql`
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
        getTask(id:ID!):Task
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

        createTask(title:String!):Task!
        updateTask(id:ID!, title:String!):Task!
        deleteTask(id:ID!):Boolean
        addUserToTask(taskId:ID!, userId:ID!):Task

        createTodo(taskId:ID!, content:String!):Todo!
        updateTodo(id:ID!, content:String, isCompleted:Boolean):Todo!
        deleteTodo(id:ID!):Boolean
    }
`;


// mongodb config
const serverStartup = async () => {
    const client = new MongoClient(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    await client.connect();
    const db = client.db(DB_NAME)
    db.collection("Users").createIndex({
        "email": 1
    }, {
        unique: true
    })
    db.collection("Tasks").createIndex({
        "title": 1
    }, {
        unique: true
    })

    // create server object
    const server = new ApolloServer({
        typeDefs, resolvers, context: async ({req}) => {
            const user = await getUserFromToken(req.headers.authorization, db)
            return {
                db,
                user
            }
        }
    })

    //start server to listen for requests
    server.listen().then(({url}) => {
        console.log(`Serving at ${url}`);
    })
}

serverStartup()