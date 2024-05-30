const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
app.use(express.json())

let db = null
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error:${e.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const convertStateDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictdbObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwt, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  const selectUserQuery = `SELECT * FROM user WHERE username = "${username}";`
  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
  SELECT 
  *
  FROM
  state
  ORDER BY
  state_id;`
  const statesArray = await db.all(getAllStatesQuery)
  response.send(
    statesArray.map(eachState =>
      convertStateDbObjectToResponseObject(eachState),
    ),
  )
})
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getState = `
  SELECT 
  *
  FROM
  state
  WHERE
  state_id = ${stateId};`
  const state = await db.get(getState)
  response.send(convertStateDbObjectToResponseObject(state))
})
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postDistrictQuery = `
  INSERT INTO 
  district(district_name,state_id,cases,cured,active,deaths)
  VALUES
     ('${districtName}',
     ${stateId},
     ${cases},
     ${cured},
     ${active},
     ${deaths});`
  await db.run(postDistrictQuery)
  response.send('District Successfully Added')
})
app.get(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrict = `
  SELECT 
  *
  FROM 
  district
  WHERE
  district_id = ${districtId};`
    const newDistrict = await db.get(getDistrict)
    const districtResult = convertDistrictDbObjectToResponseObject(newDistrict)
    response.send(districtResult)
  },
)
app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrict = `
  DELETE FROM
  district
  WHERE
  district_id = ${districtId}`
    await db.run(deleteDistrict)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictDetails = `
          UPDATE 
          district 
          SET
                     district_name = "${districtName}",
                     state_id = ${stateId},
                     cases = ${cases},
                     cured = ${cured},
                     active = ${active},
                     deaths = ${deaths}
                WHERE district_id = ${districtId};`
    await db.run(updateDistrictDetails)
    response.send('District Details Updated')
  },
)
app.get(
  '/states/:stateId/stats',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateStatsQuery = `
  SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
      FROM 
        district 
      WHERE 
        state_id = ${stateId};`
    const stats = await db.get(getStateStatsQuery)
    console.log(stats)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)
app.get(
  '/districts/:districtId/details/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictIdQuery = `
    select state_id from district
    where district_id = ${districtId};
    ` //With this we will get the state_id using district table
    const getDistrictIdQueryResponse = await db.get(getDistrictIdQuery)
    const getStateNameQuery = `
    select state_name as stateName from state
    where state_id = ${getDistrictIdQueryResponse.state_id};
    ` //With this we will get state_name as stateName using the state_id
    const getStateNameQueryResponse = await db.get(getStateNameQuery)
    response.send(getStateNameQueryResponse)
  },
) //sending the required response

module.exports = app
