const { fetchContributors, createReport } = require('./utils');
const { log } = require('./logger');

const octokit = require('@octokit/rest');

class GithubHelper {
  constructor(org, token) {
    this.org = org;
    this.github = octokit();
    this.github.authenticate({
      type: 'token',
      token: token
    });
  }

  async paginate(method, options) {
    log('paginate start');
    let response = await method(options);
    if (/^202/.test(response.status)) {
      log('github is calculatin the stats.');
      throw new Error(
        'The stats are currently being calculated. Please request again later.'
      );
    }

    let { data } = response;
    while (this.github.hasNextPage(response)) {
      log('the result has multiple pages.paginating.');
      if (/^202/.test(response.status)) {
        log('github is calculatin the stats.');
        throw new Error(
          'The stats are currently being calculated. Please request again later.'
        );
      }

      response = await this.github.getNextPage(response);

      if (!/^204/.test(response.status)) {
        log('recieved stats and concatenating to the previous results.');
        data = data.concat(response.data);
      }
    }

    if (!Array.isArray(data)) {
      data = [];
    }
    return data;
  }

  async createReport() {
    log('createReport start');
    const data = await this.paginate(this.github.repos.getForOrg, {
      org: this.org,
      page: 1,
      per_page: 100
    });

    const promises = fetchContributors(data, async repo => {
      log('fetching contributors for:', repo.name);
      const data = await this.paginate(this.github.repos.getStatsContributors, {
        owner: this.org,
        repo: repo.name
      });
      return data;
    });

    const repoInfos = await Promise.all(promises);

    return createReport(repoInfos);
  }
}

module.exports = GithubHelper;
