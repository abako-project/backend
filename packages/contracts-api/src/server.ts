import 'dotenv/config'
import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { ProjectsService } from './projects'
import { ContractError } from './util/contractError'
import { CalendarService } from './calendar'
import { DeployService } from './deployService'
import { errorHandler } from './middlewares/errorHandler'

const app = express()
const port = process.env.PORT || 3010

// Handle unhandled promise rejections globally
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Promise Rejection:', reason);
  // Don't exit the process - just log the error
});

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

let projectsService: ProjectsService
let calendarService: CalendarService
let deployService: DeployService

async function initializeServices() {
  try {
    projectsService = new ProjectsService()
    await projectsService.initialize()
    console.log('ProjectsService initialized successfully')

    calendarService = new CalendarService()
    await calendarService.initialize()
    console.log('CalendarService initialized successfully')

    deployService = new DeployService()
    console.log('DeployService initialized successfully')
  } catch (error) {
    console.error('Failed to initialize services:', error)
    process.exit(1)
  }
}

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'projects-api',
    timestamp: new Date().toISOString()
  })
})

app.get('/projects/constructors', (req: Request, res: Response) => {
  try {
    const constructors = projectsService.getAvailableConstructors()
    res.json({
      success: true,
      constructors: constructors,
      count: constructors.length
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get available constructors',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.get('/calendar/constructors', (req: Request, res: Response) => {
  try {
    const constructors = calendarService.getAvailableConstructors()
    res.json({
      success: true,
      constructors: constructors,
      count: constructors.length
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get available constructors',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.get('/projects/query/:contractAddress/:methodName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractAddress, methodName } = req.params
    const data = { ...req.query }

    if (!projectsService.validateMethod(methodName)) {
      return res.status(400).json({
        success: false,
        error: `Method "${methodName}" not found`,
        availableMethods: projectsService.getAvailableMethods()
      })
    }

    const result = await projectsService.queryMethod(contractAddress, methodName, data)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.post('/projects/call/:contractAddress/:methodName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractAddress, methodName } = req.params
    const data = req.body || {}

    if (!projectsService.validateMethod(methodName)) {
      return res.status(400).json({
        success: false,
        error: `Method "${methodName}" not found`,
        availableMethods: projectsService.getAvailableMethods()
      })
    }

    const result = await projectsService.callMethod(contractAddress, methodName, data)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.post('/projects/deploy/v6', async (req: Request, res: Response) => {
  try {
    const params = req.body

    if (!params.name || !params.dao_address) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'name and dao_address are required',
        inkVersion: '6'
      })
    }

    const configs = deployService.getDeployConfigs()
    const result = await deployService.deployContract(configs.v6, params)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('Error in deploy v6 endpoint:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      inkVersion: '6',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.post('/projects/deploy/v5', async (req: Request, res: Response) => {
  try {
    const params = req.body

    if (!params.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'name is required',
        inkVersion: '5'
      })
    }

    const configs = deployService.getDeployConfigs()
    const result = await deployService.deployContract(configs.v5, params)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('Error in deploy v5 endpoint:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      inkVersion: '5',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.get('/calendar/query/:contractAddress/:methodName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractAddress, methodName } = req.params
    const data = { ...req.query }

    console.log("Query params:", req.query)
    console.log("Data to send:", data)

    if (!calendarService.validateMethod(methodName)) {
      return res.status(400).json({
        success: false,
        error: `Method "${methodName}" not found`,
        availableMethods: calendarService.getAvailableMethods()
      })
    }

    const result = await calendarService.queryMethod(contractAddress, methodName, data)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.post('/calendar/call/:contractAddress/:methodName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractAddress, methodName } = req.params
    const data = req.body || {}

    if (!calendarService.validateMethod(methodName)) {
      return res.status(400).json({
        success: false,
        error: `Method "${methodName}" not found`,
        availableMethods: calendarService.getAvailableMethods()
      })
    }

    const result = await calendarService.callMethod(contractAddress, methodName, data)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.post('/calendar/deploy/v5', async (req: Request, res: Response) => {
  try {
    const configs = deployService.getDeployConfigs()
    const params = req.body || {} // Calendar constructor accepts empty params
    const result = await deployService.deployContract(configs.calendar_v5, params)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('Error in calendar deploy v5 endpoint:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      inkVersion: '5',
      contractType: 'calendar',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.post('/ratings/deploy/v5', async (req: Request, res: Response) => {
  console.log("Ratings deploy v5 endpoint called")
  try {
    const configs = deployService.getDeployConfigs()
    const params = req.body || {} // Ratings constructor accepts empty params
    const result = await deployService.deployContract(configs.ratings_v5, params)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('Error in ratings deploy v5 endpoint:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      inkVersion: '5',
      contractType: 'ratings',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.use(errorHandler);

async function startServer() {
  try {
    await initializeServices()

    app.listen(port, () => {
      console.log(`Projects & Calendar API server running on port ${port}`)
      console.log(`\nExample usage:`)
      console.log(`\n  Projects:`)
      console.log(`   curl http://localhost:${port}/projects/constructors`)
      console.log(`   curl "http://localhost:${port}/projects/query/0xc6a09B1C5468665AD7649ac8998D5d5eE2364814/get_project_info"`)
      console.log(`   curl "http://localhost:${port}/projects/query/0xc6a09B1C5468665AD7649ac8998D5d5eE2364814/get_project_info?project_id=1"`)
      console.log(`   curl -X POST http://localhost:${port}/projects/call/0xc6a09B1C5468665AD7649ac8998D5d5eE2364814/assign_team -H "Content-Type: application/json" -d '{"data": {"_team_size": 1}}'`)
      console.log(`   curl -X POST http://localhost:${port}/projects/deploy/v6 -H "Content-Type: application/json" -d '{"name": "My Project", "dao_address": "0x1234..."}'`)
      console.log(`   curl -X POST http://localhost:${port}/projects/deploy/v5 -H "Content-Type: application/json" -d '{"name": "My Project", "dao_address": "5E4S9C7PNW1cdYEY9p2U3bATksAQ69njeKS2JTBpTYPxKWds"}'`)
      console.log(`\n  Calendar:`)
      console.log(`   curl http://localhost:${port}/calendar/constructors`)
      console.log(`   curl "http://localhost:${port}/calendar/query/0xABCD.../get_registered_workers"`)
      console.log(`   curl "http://localhost:${port}/calendar/query/0xABCD.../get_availability_hours?worker=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"`)
      console.log(`   curl -X POST http://localhost:${port}/calendar/call/0xABCD.../register_worker -H "Content-Type: application/json" -d '{"data": {"worker": "<address>"}}'`)
      console.log(`   curl -X POST http://localhost:${port}/calendar/deploy/v5 -H "Content-Type: application/json" -d '{}'`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer() 