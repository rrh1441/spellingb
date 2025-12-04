# Spelling B- Development Notes

## Project Overview
A daily spelling game where users hear a word's pronunciation and definition, then attempt to spell it correctly.

## Tech Stack
- Next.js 15 (App Router)
- React 18
- Supabase (PostgreSQL + Storage)
- Tailwind CSS
- OpenAI TTS API (voice: onyx)

## Future Monetization Ideas

### Premium Tier ($2.99/month or $19.99/year)
- Unlimited practice mode (currently free, could gate in future)
- No ads (if ads are added later)
- Exclusive word packs
- Detailed statistics and progress tracking
- Cloud sync across devices (requires auth)
- Streak freeze (1 per month) - protect streak on missed days

### Word Packs ($1.99-4.99 each)
- SAT/GRE Prep Pack (500 words)
- Medical Terminology Pack
- Legal Terms Pack
- Business English Pack
- Scientific Terms Pack
- Foreign Loanwords Pack (French, Latin, Greek origins)
- Spelling Bee Champions Pack (past winning words)

### One-Time Purchases
- Remove ads forever: $4.99
- Lifetime premium: $49.99

### Sponsorships/Partnerships
- Partner with educational platforms (Coursera, Khan Academy)
- School/classroom licenses
- Corporate training licenses

### Affiliate Revenue
- Link to dictionary apps
- Link to vocabulary learning tools
- Recommend spelling/grammar books

## Implementation Priority
1. Build user base first with free features
2. Add optional donations (current Stripe link)
3. Consider ads after 10k+ daily users
4. Launch premium tier after 50k+ users
5. Word packs can be added anytime as content expands

## Technical Debt / Future Improvements
- [ ] Add user authentication (Supabase Auth)
- [ ] Server-side leaderboard validation
- [ ] Anti-cheat measures for competitive mode
- [ ] Offline PWA support with cached words
- [ ] Accessibility improvements (screen reader, high contrast)
- [ ] Internationalization (other languages)
- [ ] Analytics dashboard for word difficulty tracking
