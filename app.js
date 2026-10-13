import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDepartures } from './data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))

const isHtmxRequest = (request) => request.get('HX-Request') === 'true'

const isHistoryRestoreRequest = (request) =>
    request.get('HX-History-Restore-Request') === 'true'

const formatTime = (date) =>
    new Intl.DateTimeFormat('no-NO', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)

const expectedAt = (departure) =>
    new Date(departure.scheduledAt.getTime() + departure.delay * 60 * 1000)

const filterDepartures = (departures, query = '') => {
    const normalizedQuery = query.trim().toLocaleLowerCase('no-NO')

    if (!normalizedQuery) {
        return departures
    }

    return departures.filter((departure) =>
        `${departure.line} ${departure.destination}`
            .toLocaleLowerCase('no-NO')
            .includes(normalizedQuery),
    )
}

const summarize = (departures) => ({
    total: departures.length,
    onTime: departures.filter(
        (departure) => !departure.cancelled && departure.delay === 0,
    ).length,
    delayed: departures.filter(
        (departure) => !departure.cancelled && departure.delay > 0,
    ).length,
    cancelled: departures.filter((departure) => departure.cancelled).length,
})

export const createApp = ({ now = new Date(), searchDelay = 1000 } = {}) => {
    const app = express()
    const departures = createDepartures(now)
    const eventClients = new Set()

    app.set('view engine', 'ejs')
    app.set('views', path.join(__dirname, 'views'))
    app.use(express.urlencoded({ extended: false }))
    app.use('/static', express.static(path.join(__dirname, 'public')))
    app.use(
        '/vendor/entur-tokens',
        express.static(path.join(__dirname, 'node_modules/@entur/tokens/dist')),
    )
    app.use(
        '/vendor/entur-tokens/@entur/tokens/dist',
        express.static(path.join(__dirname, 'node_modules/@entur/tokens/dist')),
    )
    app.use(
        '/vendor/htmx',
        express.static(path.join(__dirname, 'node_modules/htmx.org/dist')),
    )
    app.use(
        '/vendor/htmx-ext-sse',
        express.static(path.join(__dirname, 'node_modules/htmx-ext-sse/dist')),
    )

    const viewData = ({ query = '', editId, error, delayValue } = {}) => ({
        departures: filterDepartures(departures, query),
        query,
        editId,
        error,
        delayValue,
        summary: summarize(departures),
        formatTime,
        expectedAt,
    })

    const renderDepartureUpdate = (response, departure) => {
        response.render('partials/departure-update', {
            departure,
            editId: undefined,
            error: undefined,
            summary: summarize(departures),
            formatTime,
            expectedAt,
        })
    }

    const sendBoard = (client) => {
        app.render(
            'partials/departure-sse-update',
            viewData({ query: client.query }),
            (error, html) => {
                if (error) {
                    console.error(error)
                    return
                }

                const event = `event: avganger\ndata: ${html.replaceAll('\n', '\ndata: ')}\n\n`
                client.response.write(event)
            },
        )
    }

    const broadcastBoard = () => {
        for (const client of eventClients) {
            sendBoard(client)
        }
    }

    app.get('/', (request, response) => {
        response.render(
            'index',
            viewData({
                query: request.query.q,
                editId: request.query.rediger,
            }),
        )
    })

    app.get('/avganger', async (request, response) => {
        response.vary('HX-Request')
        response.vary('HX-History-Restore-Request')
        response.vary('HX-Target')

        if (isHtmxRequest(request) && !isHistoryRestoreRequest(request)) {
            await wait(searchDelay)

            if (request.get('HX-Target') === 'live-departures') {
                return response.render(
                    'partials/live-departures',
                    viewData({ query: request.query.q }),
                )
            }

            return response.render(
                'partials/departure-board',
                viewData({ query: request.query.q }),
            )
        }

        response.render('index', viewData({ query: request.query.q }))
    })

    app.get('/avganger/:id/rediger', (request, response) => {
        response.vary('HX-Request')
        const departure = departures.find(({ id }) => id === request.params.id)

        if (!departure) {
            return response.sendStatus(404)
        }

        if (!isHtmxRequest(request)) {
            return response.redirect(`/?rediger=${departure.id}#${departure.id}`)
        }

        response.render('partials/departure-row', {
            departure,
            editId: departure.id,
            error: undefined,
            formatTime,
            expectedAt,
        })
    })

    app.get('/avganger/:id', (request, response) => {
        response.vary('HX-Request')
        const departure = departures.find(({ id }) => id === request.params.id)

        if (!departure) {
            return response.sendStatus(404)
        }

        if (!isHtmxRequest(request)) {
            return response.redirect(`/#${departure.id}`)
        }

        response.render('partials/departure-row', {
            departure,
            editId: undefined,
            error: undefined,
            delayValue: undefined,
            formatTime,
            expectedAt,
        })
    })

    app.post('/avganger/:id/forsinkelse', (request, response) => {
        const departure = departures.find(({ id }) => id === request.params.id)

        if (!departure) {
            return response.sendStatus(404)
        }

        const delayValue = request.body.delay
        const delay = Number(delayValue)
        const error =
            typeof delayValue !== 'string' ||
            delayValue.trim() === '' ||
            !Number.isInteger(delay) ||
            delay < 0 ||
            delay > 120
                ? 'Forsinkelsen må være et helt antall minutter mellom 0 og 120.'
                : undefined

        if (error) {
            const data = viewData({
                editId: departure.id,
                error,
                delayValue: typeof delayValue === 'string' ? delayValue : '',
            })

            if (isHtmxRequest(request)) {
                return response.status(422).render('partials/departure-row', {
                    ...data,
                    departure,
                })
            }

            return response.status(422).render('index', data)
        }

        departure.delay = delay
        broadcastBoard()

        if (isHtmxRequest(request)) {
            return renderDepartureUpdate(response, departure)
        }

        response.redirect(`/#${departure.id}`)
    })

    const setCancelled = (cancelled) => (request, response) => {
        const departure = departures.find(({ id }) => id === request.params.id)

        if (!departure) {
            return response.sendStatus(404)
        }

        departure.cancelled = cancelled
        broadcastBoard()

        if (isHtmxRequest(request)) {
            return renderDepartureUpdate(response, departure)
        }

        response.redirect(`/#${departure.id}`)
    }

    app.post('/avganger/:id/innstill', setCancelled(true))
    app.post('/avganger/:id/sett-opp', setCancelled(false))

    app.get('/hendelser', (request, response) => {
        response.set({
            'Cache-Control': 'no-cache',
            'Content-Type': 'text/event-stream',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        })
        response.flushHeaders()
        response.write('retry: 2000\n\n')
        const client = {
            query: typeof request.query.q === 'string' ? request.query.q : '',
            response,
        }
        eventClients.add(client)

        request.on('close', () => {
            eventClients.delete(client)
        })
    })

    return app
}
