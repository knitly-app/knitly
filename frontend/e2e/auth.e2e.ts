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

const post = {
  id: 'post-1',
  userId: user.id,
  content: 'Hello from Knitly',
  createdAt: '2025-01-02T12:00:00.000Z',
  reactions: {},
  userReaction: null,
  comments: 0,
  author: { username: user.username, displayName: user.displayName, avatar: user.avatar },
}

test('login then view feed', async ({ page }) => {
  let authed = false

  await page.route('**/api/auth/me', async (route) => {
    if (authed) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
      })
      return
    }

    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Not authenticated' }),
    })
  })

  await page.route('**/api/auth/login', async (route) => {
    authed = true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    })
  })

  await page.route('**/api/feed**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ posts: [post], nextCursor: null }),
    })
  })

  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/circles', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ appName: 'Knitly', logoIcon: 'Zap' }),
    })
  })

  await page.goto('/')

  await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  await page.getByPlaceholder('you@example.com').fill('mike@knitly.io')
  await page.getByPlaceholder('Enter your password').fill('password123')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page.getByText('Hello from Knitly')).toBeVisible()
})
