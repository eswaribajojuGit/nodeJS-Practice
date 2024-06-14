const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const dbPath = path.join(__dirname, 'twitterClone.db')
const app = express()
app.use(express.json())
let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`DB Error:${error.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

const getFollowingPeopleIdsOfUser = async username => {
  const getfollowingPeopleQuery = `
    SELECT following_user_id FROM follower 
    INNER JOIN user ON user.user_id = follower.follower_user_id 
    WHERE user.username = "${username}";`
  const followingPeople = await db.all(getfollowingPeopleQuery)
  const arrayOfIds = followingPeople.map(eachUser => eachUser.following_user_id)
  return arrayOfIds
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken) {
    jwt.verify(jwtToken, 'SECRET_KEY', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        request.userId = payload.userId
        next()
      }
    })
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

const tweetAccessVerification = async (request, response, next) => {
  const {userId} = request
  const {tweetId} = request.params
  const getTweetQuery = `
    SELECT * FROM tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id
    WHERE tweet.tweet_id = "${tweetId} AND follower_user_id = "${userId}";`
  const tweet = await db.get(getTweetQuery)
  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}

//API1
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username = "${username}"`
  const userDbDetails = await db.get(getUserQuery)

  if (userDbDetails !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const createUserQuery = `INSERT INTO user(username,password,name,gender)
      VALUES("${username}","${password}","${name}","${gender}");`
      await db.run(createUserQuery)
      response.send('User created successfully')
    }
  }
})

//API2
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `select * from user where username = "${username}";`
  const userDbDetails = await db.get(getUserQuery)
  if (userDbDetails !== undefined) {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      userDbDetails.password,
    )

    if (isPasswordCorrect) {
      const payload = {username, userId: userDbDetails.user_id}
      const jwtToken = jwt.sign(payload, 'SECRET_KEY')
      response.send({jwtToken})
    } else {
      //sinario2
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    //sinario1
    response.status(400)
    response.send('Invalid user')
  }
})
//API3
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const {username} = request
  const followingPeopleIds = await getFollowingPeopleIdsOfUser(username)

  const getTweetsQuery = `
  SELECT username,tweet,date_time as dateTime FROM user INNER JOIN tweet ON user.user_id = tweet.user_id 
  WHERE user.user_id IN (${followingPeopleIds})
  ORDER BY date_time DESC 
  LIMIT 4;`
  const tweets = await db.all(getTweetsQuery)
  response.send(tweets)
})
//API4
app.get('/user/following/', authenticateToken, async (request, response) => {
  const {username, userId} = request
  const getFollowingUsersQuery = `
  SELECT name FROM follower INNER JOIN user ON user.user_id = follower.following_user_id
  WHERE follower_user_id = "${userId}";`
  const followingPeople = await db.all(getFollowingUsersQuery)
  response.send(followingPeople)
})
//API5
app.get('/user/followers/', authenticateToken, async (request, response) => {
  const {username, userId} = request
  const getFollowersQuery = `
  SELECT DISTINCT name FROM follower INNER JOIN user ON user.user_id = follower.follower_user_id
  WHERE following_user_id = "${userId}";`
  const followers = await db.all(getFollowersQuery)
  response.send(followers)
})
//API6
app.get(
  '/tweets/:tweetId/',
  authenticateToken,
  tweetAccessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params
    const getTweetQueryQuery = `
  SELECT tweet,
  (SELECT COUNT() FROM like WHERE tweet_id = "${tweetId}") AS likes,
  (SELECT COUNT() FROM reply WHERE tweet_id = "${tweetId}") AS replies,
  date_time AS dateTime FROM tweet WHERE tweet.tweet_id = "${tweetId}";`
    const tweet = await db.get(getTweetQuery)
    const usersArray = likedUsers.map(eachUser => eachUser.username)
    response.send(tweet)
  },
)
//API7
app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  tweetAccessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params
    const getLikesQuery = `
  SELECT username FROM user INNER JOIN like ON user.user_id = like.user_id
  WHERE tweet_id = "${tweetId}";`
    const likedUsers = await db.all(getLikesQuery)
    const usersArray = likedUsers.map(eachUser => eachUser.username)
    response.send({likes: usersArray})
  },
)

module.exports = app
