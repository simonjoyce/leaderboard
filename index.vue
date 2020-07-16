<template>
    <div>
        <div v-if="ready && !wait && !leaderboard" class="container bg-extra-dark py-5 my-4">
            <h1 class="display-5 text-center">Leaderboard Not Found</h1>
        </div>
        <b-row v-else-if="leaderboard">
            <b-col cols="12" lg="10" class="p-0">
                <div class="pt-4 pb-5 mx-sm-4 ml-lg-5 pl-lg-5">

                    <div class="mt-4 ml-lg-5 bg-extra-dark rounded">
                        <div class="bg-blurple p-2 rounded-top">
                            <LeaderboardTitle :leaderboard="leaderboard" title="Leaderboard"/>
                        </div>

                        <div class="mt-2 pb-2">
                            <div v-if="leaderboard.balances.length">
                                <div v-for="balance in leaderboard.balances" :key="balance.user_id">
                                    <User :balance="balance"/>
                                </div>
                            </div>
                            <h5 v-else-if="leaderboard.total_pages === 0" class="my-4">
                                Nothing to see here yet!
                            </h5>

                            <client-only>
                                <infinite-loading @infinite="infiniteHandler">
                                    <img slot="spinner" class="mt-3" src="@/assets/loading.svg" width="40px" height="40px"alt="loading icon">
                                </infinite-loading>
                            </client-only>
                        </div>
                    </div>
                </div>
            </b-col>

            <b-col class="mt-5 d-none d-lg-block" lg="2">
                <div class="p-2 bg-extra-dark rounded">
                    <div class="title mb-2">Widget</div>
                    <img class="mb-2" src="@/assets/widget.png" width="100%" alt="widget preview banner">
                    <div class="mb-2">Embed this leaderboard onto your own website using the HTML code below:</div>
                    <code class="d-block">{{widgetCode}}</code>
                </div>
            </b-col>
        </b-row>

        <Loading v-else/>
    </div>
</template>

<script>
    import User from '@/components/LeaderboardUser';
    import LeaderboardTitle from '@/components/LeaderboardTitle';
    import Loading from '@/components/Loading';

    export default {
        name: 'Leaderboard',
        components: { User, LeaderboardTitle, Loading },
        data() {
            return {
                wait: true,
                done: false
            };
        },
        validate({ params }) {
            return /^[0-9]{16,20}$/.test(params.id);
        },
        computed: {
            ready() {
                return this.leaderboard.ready;
            },
            widgetURL() {
                return `${this.$config.BASE_URL}/leaderboard/${this.$route.params.id}/widget`;
            },
            widgetCode() {
                return `<iframe src="${this.widgetURL}" width="450" height="500" style="border: 0;"></iframe>`;
            },
            leaderboard() {
                return this.$store.getters.leaderboard;
            }
        },
        methods: {
            infiniteHandler($state) {
                const checkDone = () => {
                    if (this.done) {
                        $state.complete();
                    } else {
                        $state.loaded();
                    }
                };

                if (this.ready && !this.done) {
                    setTimeout(async () => {
                        await this.loadUsers();
                        checkDone();
                    }, 500);
                } else {
                    setTimeout(() => checkDone(), 1100);
                }
            },
            loadUsers() {
                return this.$store.dispatch('GET_LEADERBOARD', {
                    id: this.$route.params.id,
                    params: {
                        sort: this.$route.query.sort,
                        limit: 25,
                        page: this.leaderboard.page ? this.leaderboard.page + 1 : 1
                    }
                }).then(data => {
                    if (data) {
                        if (!data.balances.length || data.page === data.total_pages) {
                            this.done = true;
                        }
                    }
                });
            }
        },
        mounted() {
            setTimeout(() => this.wait = false, 250);
            if (this.leaderboard.id !== this.$route.params.id) {
                this.$store.commit('RESET_LEADERBOARD');
            }

            if (!this.ready) {
                this.loadUsers();
            }
        }
    };
</script>
