import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createApp } from '../app.js'

describe('Neste avgang', { concurrency: false }, () => {
    let server
    let baseUrl

    beforeEach(async () => {
        const app = createApp({
            now: new Date('2026-10-05T08:00:00+02:00'),
            searchDelay: 0,
        })
        server = await new Promise((resolve) => {
            const candidate = app.listen(0, '127.0.0.1', () => resolve(candidate))
        })
        baseUrl = `http://127.0.0.1:${server.address().port}`
    })

    afterEach(() => server.close())

    it('renders a complete page', async () => {
        const response = await fetch(baseUrl)
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.match(html, /Neste avgang/)
        assert.match(html, /Lillehammer/)
    })

    it('returns only the departure board for an htmx search', async () => {
        const response = await fetch(`${baseUrl}/avganger?q=Bergen`, {
            headers: { 'HX-Request': 'true' },
        })
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.match(response.headers.get('vary'), /HX-Request/)
        assert.match(response.headers.get('vary'), /HX-History-Restore-Request/)
        assert.match(response.headers.get('vary'), /HX-Target/)
        assert.match(html, /1 treff på «Bergen»/)
        assert.match(html, /F4/)
        assert.doesNotMatch(html, /<!doctype html>/)
    })

    it('returns a complete page when htmx restores history', async () => {
        const response = await fetch(`${baseUrl}/avganger?q=Bergen`, {
            headers: {
                'HX-History-Restore-Request': 'true',
                'HX-Request': 'true',
            },
        })
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.match(html, /<!doctype html>/)
        assert.match(html, /value="Bergen"/)
        assert.doesNotMatch(html, /Lillehammer/)
    })

    it('returns an SSE wrapper for the live search target', async () => {
        const response = await fetch(`${baseUrl}/avganger?q=Bergen`, {
            headers: {
                'HX-Request': 'true',
                'HX-Target': 'live-departures',
            },
        })
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.match(html, /id="live-departures"/)
        assert.match(html, /1 treff på «Bergen»/)
    })

    it('redirects a normal cancel navigation to the complete page', async () => {
        const response = await fetch(`${baseUrl}/avganger/r10-1`, {
            redirect: 'manual',
        })

        assert.equal(response.status, 302)
        assert.equal(response.headers.get('location'), '/#r10-1')
        assert.match(response.headers.get('vary'), /HX-Request/)
    })

    it('marks edit fragments as varying on HX-Request', async () => {
        const response = await fetch(`${baseUrl}/avganger/r10-1/rediger`, {
            headers: { 'HX-Request': 'true' },
        })
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.match(response.headers.get('vary'), /HX-Request/)
        assert.match(html, /Forsinkelse i minutter/)
    })

    it('keeps an invalid submitted value in the form', async () => {
        const response = await fetch(`${baseUrl}/avganger/r10-1/forsinkelse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'HX-Request': 'true',
            },
            body: 'delay=121',
        })
        const html = await response.text()

        assert.equal(response.status, 422)
        assert.match(html, /mellom 0 og 120/)
        assert.match(html, /value="121"/)
    })

    it('rejects an empty delay on the server', async () => {
        const response = await fetch(`${baseUrl}/avganger/r10-1/forsinkelse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'HX-Request': 'true',
            },
            body: 'delay=',
        })
        const html = await response.text()

        assert.equal(response.status, 422)
        assert.match(html, /mellom 0 og 120/)
        assert.match(html, /value=""/)
    })

    it('renders a validation error in a complete page without htmx', async () => {
        const response = await fetch(`${baseUrl}/avganger/r10-1/forsinkelse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'delay=121',
        })
        const html = await response.text()

        assert.equal(response.status, 422)
        assert.match(html, /<!doctype html>/)
        assert.match(html, /mellom 0 og 120/)
        assert.match(html, /value="121"/)
    })

    it('returns an updated row after a valid delay', async () => {
        const response = await fetch(`${baseUrl}/avganger/r10-1/forsinkelse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'HX-Request': 'true',
            },
            body: 'delay=15',
        })
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.match(html, /15 min forsinket/)
        assert.match(html, /id="r10-1"/)
    })

    it('does not put a cancelled departure back in service when its delay changes', async () => {
        const response = await fetch(`${baseUrl}/avganger/54-1/forsinkelse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'HX-Request': 'true',
            },
            body: 'delay=10',
        })
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.match(html, />Innstilt</)
        assert.match(html, /\/sett-opp/)
        assert.doesNotMatch(html, /10 min forsinket/)
    })

    it('keeps status changes idempotent', async () => {
        const requestOptions = {
            method: 'POST',
            headers: { 'HX-Request': 'true' },
        }

        await fetch(`${baseUrl}/avganger/r10-1/innstill`, requestOptions)
        const response = await fetch(
            `${baseUrl}/avganger/r10-1/innstill`,
            requestOptions,
        )
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.match(html, />Innstilt</)
        assert.match(html, /\/sett-opp/)
    })

    it('sends filtered boards and the current summary over SSE', async () => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2000)
        const events = await fetch(`${baseUrl}/hendelser?q=Bergen`, {
            signal: controller.signal,
        })
        const reader = events.body.getReader()

        try {
            await reader.read()
            await fetch(`${baseUrl}/avganger/f4-1/forsinkelse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'HX-Request': 'true',
                },
                body: 'delay=0',
            })

            let event = ''
            while (!event.includes('event: avganger')) {
                const chunk = await reader.read()
                event += new TextDecoder().decode(chunk.value)
            }

            assert.match(event, /1 treff på «Bergen»/)
            assert.match(event, /F4/)
            assert.doesNotMatch(event, /Lillehammer/)
            assert.match(event, /id="summary"/)
            assert.match(event, /<dd>6<\/dd>/)
            assert.match(event, /<dd>3<\/dd>/)
        } finally {
            clearTimeout(timeout)
            controller.abort()
        }
    })
})
