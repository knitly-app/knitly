import { db } from "./core.js";

export const pollQueries = {
  createPoll(postId, question, options) {
    const tx = db.transaction((pId, q, opts) => {
      const pollResult = db.prepare(`
        INSERT INTO polls (post_id, question) VALUES (?, ?)
      `).run(pId, q);
      const pollId = pollResult.lastInsertRowid;

      const insertOption = db.prepare(`
        INSERT INTO poll_options (poll_id, option_text, sort_order) VALUES (?, ?, ?)
      `);
      opts.forEach((text, index) => {
        insertOption.run(pollId, text, index);
      });

      return pollId;
    });
    return tx(postId, question, options);
  },

  getPoll(postId) {
    const poll = db.prepare(`
      SELECT id, post_id, question, created_at
      FROM polls WHERE post_id = ?
    `).get(postId);
    if (!poll) return null;

    const options = db.prepare(`
      SELECT po.id, po.option_text, po.sort_order,
             COUNT(pv.user_id) as vote_count
      FROM poll_options po
      LEFT JOIN poll_votes pv ON po.id = pv.option_id
      WHERE po.poll_id = ?
      GROUP BY po.id
      ORDER BY po.sort_order ASC
    `).all(poll.id);

    const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);

    return {
      id: poll.id,
      postId: poll.post_id,
      question: poll.question,
      createdAt: poll.created_at,
      totalVotes,
      options,
    };
  },

  getPollsMap(postIds = []) {
    const map = new Map();
    if (!postIds.length) return map;
    const placeholders = postIds.map(() => "?").join(", ");
    const polls = db.prepare(`
      SELECT id, post_id, question, created_at
      FROM polls WHERE post_id IN (${placeholders})
    `).all(...postIds);
    if (!polls.length) return map;

    const pollIds = polls.map(p => p.id);
    const optionRows = db.prepare(`
      SELECT po.poll_id, po.id, po.option_text, po.sort_order,
             COUNT(pv.user_id) as vote_count
      FROM poll_options po
      LEFT JOIN poll_votes pv ON po.id = pv.option_id
      WHERE po.poll_id IN (${pollIds.map(() => "?").join(", ")})
      GROUP BY po.id
      ORDER BY po.sort_order ASC
    `).all(...pollIds);

    const optionsByPoll = new Map();
    optionRows.forEach(({ poll_id, ...opt }) => {
      if (!optionsByPoll.has(poll_id)) optionsByPoll.set(poll_id, []);
      optionsByPoll.get(poll_id).push(opt);
    });

    polls.forEach(poll => {
      const options = optionsByPoll.get(poll.id) || [];
      map.set(poll.post_id, {
        id: poll.id,
        postId: poll.post_id,
        question: poll.question,
        createdAt: poll.created_at,
        totalVotes: options.reduce((sum, opt) => sum + opt.vote_count, 0),
        options,
      });
    });
    return map;
  },

  getUserPollVotesMap(userId, pollIds = []) {
    const map = new Map();
    if (!pollIds.length) return map;
    const placeholders = pollIds.map(() => "?").join(", ");
    const rows = db.prepare(`
      SELECT poll_id, option_id FROM poll_votes
      WHERE user_id = ? AND poll_id IN (${placeholders})
    `).all(userId, ...pollIds);
    rows.forEach(row => map.set(row.poll_id, row.option_id));
    return map;
  },

  getUserPollVote(userId, pollId) {
    const row = db.prepare(`
      SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?
    `).get(pollId, userId);
    return row ? row.option_id : null;
  },

  votePoll(userId, pollId, optionId) {
    const option = db.prepare(`
      SELECT id FROM poll_options WHERE id = ? AND poll_id = ?
    `).get(optionId, pollId);
    if (!option) return { error: "Invalid option" };

    const existing = db.prepare(`
      SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ?
    `).get(pollId, userId);
    if (existing) return { error: "Already voted" };

    db.prepare(`
      INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)
    `).run(pollId, optionId, userId);

    return { success: true };
  },
};
