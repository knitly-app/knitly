import { test, expect } from '@playwright/test'

const user = {
  id: 'user-1',
  username: 'mike',
  displayName: 'Mike',
  avatar: '',
  bio: 'Building things.',
  createdAt: '2025-01-01T12:00:00.000Z',
  followers: 10,
  following: 12,
  isFollowing: false,
}

test('create post from feed', async ({ page }) => {
  let posts = [] as Array<Record<string, unknown>>

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    })
  })

  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/feed**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ posts, nextCursor: null }),
    })
  })

  await page.route('**/api/posts', async (route) => {
    const postData = route.request().postData()
    let payload: unknown = {}
    if (postData) {
      try {
        payload = JSON.parse(postData) as unknown
      } catch {
        payload = {}
      }
    }
    const content =
      typeof payload === 'object' && payload && 'content' in payload
        ? String((payload as { content: unknown }).content)
        : 'New post'

    const newPost = {
      id: `post-${posts.length + 1}`,
      userId: user.id,
      content,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      liked: false,
      author: { username: user.username, displayName: user.displayName, avatar: user.avatar },
    }

    posts = [newPost, ...posts]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(newPost),
    })
  })

  await page.goto('/')

  await page.getByRole('button', { name: 'New Moment' }).click()
  await expect(page.getByPlaceholder("What's happening?")).toBeVisible()

  await page.getByPlaceholder("What's happening?").fill('Testing Knitly')
  await page.getByRole('button', { name: 'Share' }).click()

  await expect(page.getByText('Testing Knitly')).toBeVisible()
})
