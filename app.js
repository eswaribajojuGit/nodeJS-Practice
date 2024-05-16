const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()

const dbPath = path.join(__dirname, 'cricketMatchDetails.db')
app.use(express.json())

let db = null
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const convertPlayerDbObjectToResponseObject = dbObject => {
  return {
    playerId: dbObject.player_id,
    playerName: dbObject.player_name,
  }
}

const convertMatchDbObjectToResponseObject = dbObject => {
  return {
    matchId: dbObject.match_id,
    match: dbObject.match,
    year: dbObject.year,
  }
}

const convertPlayerMatchScoreDbObjectToResponseObject = dbObject => {
  return {
    playerMatchId: dbObject.player_match_id,
    playerId: dbObject.player_id,
    matchId: dbObject.match_id,
    score: dbObject.score,
    fours: dbObject.fours,
    sixes: dbObject.sixes,
  }
}

app.get('/players/', async (request, response) => {
  const getAllPlayersQuery = `
  SELECT
  *
  FROM
  player_details
  ORDER BY
  player_id;`
  const playersArray = await db.all(getAllPlayersQuery)
  response.send(
    playersArray.map(eachPlayer =>
      convertPlayerDbObjectToResponseObject(eachPlayer),
    ),
  )
})
app.get('/players/:playerId/', async (request, response) => {
  const {playerId} = request.params
  const getPlayerQuery = `
  SELECT
  *
  FROM
  player_details
  WHERE
  player_id = ${playerId};`
  const player = await db.get(getPlayerQuery)
  response.send(convertPlayerDbObjectToResponseObject(player))
})

app.put('/players/:playerId/', async (request, response) => {
  const {playerId, playerName} = request.params
  const updatePlayerDetails = `
  UPDATE
  player_details
  SET
      player_name="${playerName}"
  WHERE
      player_id = ${playerId};`
  await db.run(updatePlayerDetails)
  response.send('Player Details Updated')
})

app.get('/matches/:matchId/', async (request, response) => {
  const {matchId} = request.params
  const getMatchDetailsQuery = `
  SELECT
  *
  FROM
  match_details
  WHERE
  match_id = ${matchId};`
  const match = await db.get(getMatchDetailsQuery)
  response.send(convertMatchDbObjectToResponseObject(match))
})
app.get('/players/:playerId/matches', async (request, response) => {
  const {playerId} = request.params
  const getPlayerMatchQuery = `
  SELECT
  *
  FROM
  player_match_score 
     NATURAL JOIN match_details
  WHERE
    player_id = ${playerId};`
  const playerMatches = await db.all(getPlayerMatchQuery)
  response.send(
    playerMatches.map(eachMatch =>
      convertMatchDbObjectToResponseObject(eachMatch),
    ),
  )
})

module.exports = app
