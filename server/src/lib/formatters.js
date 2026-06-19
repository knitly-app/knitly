export function formatUser(user, { includeEmail = false } = {}) {
  const result = {
    id: String(user.id ?? user.user_id),
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    role: user.role,
    createdAt: user.created_at,
  };
  if (includeEmail && user.email) result.email = user.email;
  return result;
}

export function formatUserProfile(user) {
  return {
    ...formatUser(user),
    header: user.header || undefined,
    location: user.location || undefined,
    website: user.website || undefined,
  };
}

export function formatAdminUser(user) {
  return { ...formatUser(user), disabledAt: user.disabled_at || null };
}

export function formatComment(comment) {
  return {
    id: String(comment.id),
    postId: String(comment.post_id),
    userId: String(comment.user_id),
    username: comment.username,
    displayName: comment.display_name,
    avatar: comment.avatar || undefined,
    role: comment.role || undefined,
    content: comment.content,
    createdAt: comment.created_at,
  };
}

export function formatPoll(poll, userVote = null) {
  if (!poll) return null;
  return {
    id: String(poll.id),
    question: poll.question,
    userVote: userVote ? String(userVote) : null,
    totalVotes: poll.totalVotes,
    options: poll.options.map((opt) => ({
      id: String(opt.id),
      optionText: opt.option_text,
      voteCount: opt.vote_count,
      sortOrder: opt.sort_order,
    })),
  };
}

export function formatPost(post, { userReaction = null, poll = null, userVote = null, circleIds = null } = {}) {
  const result = {
    id: String(post.id),
    userId: String(post.user_id),
    content: post.content,
    media: post.media || [],
    createdAt: post.created_at,
    reactions: post.reactions || {},
    userReaction,
    comments: post.comments,
    poll: formatPoll(poll, userVote),
    author: {
      username: post.username,
      displayName: post.display_name,
      avatar: post.avatar || undefined,
      role: post.role || undefined,
    },
  };
  if (circleIds !== null) result.circleIds = circleIds;
  return result;
}
