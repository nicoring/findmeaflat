const { NoNewListingsError } = require('lib/errors')
const { shorten } = require('lib/utils')
const Store = require('lib/store')

const notify = require('lib/services/notify')
const xray = require('lib//services/scraper')

class FlatFinder {
  constructor (source) {
    this._store = new Store(source.name)
    this._fullCrawl = true
    this._source = source
  }

  run () {
    return Promise.resolve(this._source.url)
      .then(this._getListings.bind(this))
      .then(this._normalize.bind(this))
      .then(this._filter.bind(this))
      .then(this._findNew.bind(this))
      .then(this._notify.bind(this))
      .then(this._save.bind(this))
      .catch(this._handleError.bind(this))
  }

  _getListings (url) {
    return new Promise((resolve, reject) => {
      let x = xray(url, this._source.crawlContainer, [this._source.crawlFields])

      if (!!this._source.paginage && this._fullCrawl) {
        this._fullCrawl = false
        x = x.paginate(this._source.paginage)
      }

      x((err, listings) => {
        if (err) reject(err)
        resolve(listings)
      })
    })
  }

  _normalize (listings) {
    return listings.map(this._source.normalize)
  }

  _filter (listings) {
    return listings.filter(this._source.filter)
  }

  _findNew (listings) {
    const newListings = listings.filter(o => this._store.knownListings.indexOf(o.id) === -1)

    if (newListings.length === 0) throw new NoNewListingsError()

    return newListings
  }

  _notify (newListings) {
    console.log(`-- ${this._source.name} : ${newListings.length} --`)
    console.log(
        newListings.map(l => shorten(l.title, 100) + '\n' + l.link).join('\n'))

    const sendNotifications = newListings.map(o => (
      notify.send(
        `*${shorten(o.title.replace(/\*/g, ''))}*\n` +
        `${o.address} | ${o.price} | ${o.size}\n` +
        `${o.link}`
      )
    ))

    return Promise.all(sendNotifications).then(() => newListings)
  }

  _save (newListings) {
    this._store.knownListings = [...this._store.knownListings, ...(newListings.map(l => l.id))]
    return newListings
  }

  _handleError (err) {
    if (err.name === 'NoNewListingsError') {
      console.log(
        `${this._source.name}: No new listings since last invocation.`)
    }
    if (err.name !== 'NoNewListingsError') console.error(err)
    return false
  }
}

class FlatFinderStub {
  run() {
    return Promise.resolve(false)
  }
}

FlatFinder.Stub = FlatFinderStub
module.exports = FlatFinder
