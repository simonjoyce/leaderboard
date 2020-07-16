const { Router } = require('express');

const redis = require('../redis');
const currency = require('../managers/currency');

module.exports = async ({ RateLimit, gatewayManager }) => {
    const router = Router();

    //  Rate limiting (10 request per 5 seconds)
    router.use('/leaderboards/:id', RateLimit(10, 5000));

    /**
     * GET /leaderboards/:id
     * @return {Promise<{ balances: Array, page: Number, total_pages: Number }>}
     */
    router.get('/leaderboards/:id', async (req, res) => {
            //  Ensure page query
            if (!req.query.page) {
                req.query.page = 1;
            }

            //  Default and maximum limit of 25
            if (!req.query.limit || req.query.limit > 25) {
                req.query.limit = 25;
            }

            const { balances, page, total_pages } = await getLeaderboard(req);
            res.json({ balances, page, total_pages });
        });

    /**
     * Parse the request and fetch the leaderboard
     * @param {Request} req
     * @return {Promise<{ balances: Array, page: Number, total_pages: Number }>}
     */
    async function getLeaderboard(req) {
        //  Extract the sort query, or by default sort by total
        const orderBy = ['total', 'cash', 'bank'].find(i => req.query.sort === i) || 'total';
        
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || null;
        let page = parseInt(req.query.page) || null;
        let totalPages = null;

        //  If a page query parameter is given calculate the offset and limit
        if (req.query.hasOwnProperty('page')) {

            //  Default values
            page = page || 1;
            limit = limit || 1000;

            //  If there's no total pages, return an empty array for balances
            totalPages = await currency.leaderboardTotalPages(req.params.id, limit);
            if (!totalPages) {
                return {
                    balances: [],
                    page: page,
                    total_pages: totalPages
                };
            }

            //  If offset query not given calculate it based on the page
            if (!req.query.hasOwnProperty('offset')) {
                if (page < 1 || isNaN(page)) page = 1;
                if (page > totalPages) page = totalPages;
                offset = Math.abs((page - 1) * limit);
            }
        }

        const balances = await fetchLeaderboard(req.params.id, { limit, offset, orderBy });
        return {
            balances: balances || [],
            page: page,
            total_pages: null
        };
    }

    /**
     * Fetch a leaderboard from cache or database
     * @param leaderboardID
     * @param limit
     * @param offset
     * @param orderBy
     * @return {Promise<*>}
     */
    async function fetchLeaderboard(leaderboardID, { limit, offset, orderBy }) {
        let users = await getLeaderboardCache(leaderboardID, orderBy);
        if (!users) {
            users = await currency.fetchLeaderboard(leaderboardID, true, { orderBy });
            setLeaderboardCache(leaderboardID, users, orderBy);
        }

        if (offset) {
            users = users.slice(offset - 1);
        }

        if (limit) {
            users = users.slice(0, limit);
        }

        return users;
    }

    /**
     * Cache leaderboard for 300s (5 minutes)
     * @param leaderboardID
     * @param data
     * @param orderBy
     */
    function setLeaderboardCache(leaderboardID, data, orderBy) {
        return redis.set(`${leaderboardID}:leaderboard:${orderBy}`, JSON.stringify(data), 'EX', 300);
    }

    /**
     * Get leaderboard cache
     * @param leaderboardID
     * @param orderBy
     * @return {Promise<Array|null>}
     */
    async function getLeaderboardCache(leaderboardID, orderBy) {
        const data = await redis.get(`${leaderboardID}:leaderboard:${orderBy}`);
        return data ? JSON.parse(data) : null;
    }

    return router;
};
