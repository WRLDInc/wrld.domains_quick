# Development Guide

## Development Environment Setup

### Prerequisites
- Node.js 18+ and npm
- Git
- Code editor (VS Code recommended)
- Cloudflare account (for testing Workers locally)

### Initial Setup

1. **Clone and install**:
```bash
git clone https://github.com/WRLDInc/wrld.domains_quick.git
cd wrld.domains_quick
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your WHMCS credentials
```

3. **Start development server**:
```bash
npm run dev
```

Visit `http://localhost:3000`

## Project Architecture

### Frontend (React + TypeScript)
```
src/
├── components/       # Reusable UI components
├── pages/           # Route page components
├── lib/             # Utility libraries
├── types/           # TypeScript type definitions
└── styles/          # Global CSS styles
```

### Backend (Cloudflare Workers)
```
functions/
└── api/
    ├── domains/     # Domain search endpoints
    ├── auth/        # Authentication endpoints
    └── support/     # Support ticket endpoints
```

## Tech Stack Details

### Frontend
- **React 18**: UI framework with hooks
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Wouter**: Lightweight routing (2KB)
- **Framer Motion**: Animations
- **CSS**: CSS-in-JS via style tags

### Backend
- **Cloudflare Workers**: Serverless functions
- **Cloudflare KV**: Key-value storage
- **WHMCS API**: Domain and customer management

## Code Style Guide

### TypeScript
- Use functional components with hooks
- Prefer `const` over `let`
- Use explicit types for function parameters
- Use interfaces for object shapes

```typescript
// Good
interface User {
  id: string;
  email: string;
}

const getUser = async (id: string): Promise<User> => {
  // ...
}

// Avoid
const getUser = async (id) => {
  // ...
}
```

### React Components
- Use functional components
- Extract reusable logic to custom hooks
- Keep components focused and small
- Use TypeScript for props

```tsx
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>
}
```

### CSS
- Use CSS custom properties (variables)
- Follow BEM-like naming for classes
- Scope styles to components
- Use semantic color names

```css
/* Good */
.search-button {
  background: var(--color-primary);
  padding: var(--spacing-md);
}

/* Avoid */
.btn {
  background: #0ea5e9;
  padding: 16px;
}
```

## API Development

### Creating New Endpoints

1. **Create function file**:
```typescript
// functions/api/example/endpoint.ts
interface Env extends CloudflareEnv {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json();

    // Your logic here

    return new Response(JSON.stringify({ result: 'success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      result: 'error',
      message: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

2. **Access via**: `/api/example/endpoint`

### WHMCS Integration

Use the `WHMCSClient` class:

```typescript
import { WHMCSClient } from '@/lib/whmcs-client';

const client = new WHMCSClient({
  url: env.WHMCS_URL,
  apiIdentifier: env.WHMCS_API_IDENTIFIER,
  apiSecret: env.WHMCS_API_SECRET,
});

const result = await client.checkDomainAvailability(['example.com']);
```

## Testing

### Manual Testing
```bash
npm run dev
# Test in browser
```

### Testing API Endpoints
```bash
# Test domain check
curl -X POST http://localhost:3000/api/domains/check \
  -H "Content-Type: application/json" \
  -d '{"domains": ["example.com", "example.net"]}'
```

### Testing Production Build
```bash
npm run build
npm run preview
```

## Common Tasks

### Adding a New Page

1. Create page component:
```tsx
// src/pages/NewPage.tsx
export function NewPage() {
  return (
    <div className="new-page">
      <h1>New Page</h1>
    </div>
  );
}
```

2. Add route in `App.tsx`:
```tsx
import { NewPage } from '@/pages/NewPage';

<Route path="/new-page" component={NewPage} />
```

### Adding a New Component

1. Create component file:
```tsx
// src/components/NewComponent.tsx
interface NewComponentProps {
  title: string;
}

export function NewComponent({ title }: NewComponentProps) {
  return <div>{title}</div>
}
```

2. Import and use:
```tsx
import { NewComponent } from '@/components/NewComponent';

<NewComponent title="Hello" />
```

### Updating Styles

Global styles are in `src/styles/global.css`:
```css
:root {
  --color-new: #ff0000;
}
```

Component-specific styles use inline `<style>` tags:
```tsx
export function MyComponent() {
  return (
    <>
      <div className="my-component">Content</div>
      <style>{`
        .my-component {
          color: var(--color-primary);
        }
      `}</style>
    </>
  );
}
```

### Adding WHMCS API Methods

Extend `WHMCSClient` in `src/lib/whmcs-client.ts`:

```typescript
async getNewData(param: string): Promise<any> {
  return this.makeRequest('GetNewData', {
    param,
  });
}
```

## Debugging

### Frontend Debugging
- Use React DevTools browser extension
- Add `console.log()` statements
- Use browser DevTools debugger
- Check Network tab for API calls

### Backend Debugging
- Check Cloudflare Workers logs:
```bash
wrangler tail
```
- Add console.log in functions (visible in wrangler tail)
- Check response in Network tab

### Common Issues

**Problem**: CORS errors
**Solution**: Check WHMCS API CORS settings, ensure proper headers

**Problem**: API returns 401
**Solution**: Verify WHMCS API credentials in environment

**Problem**: KV not working
**Solution**: Check namespace bindings in wrangler.toml

**Problem**: Build fails
**Solution**: Clear cache, reinstall dependencies

## Performance Tips

### Frontend
- Code split large components
- Lazy load routes with React.lazy()
- Optimize images (use WebP)
- Minimize bundle size

### Backend
- Cache WHMCS responses when possible
- Use KV for frequently accessed data
- Minimize API calls to WHMCS
- Use Cloudflare Cache API

## Git Workflow

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring

### Commit Messages
```
feat: Add domain filtering feature
fix: Resolve search button disabled state
docs: Update API documentation
refactor: Simplify WHMCS client logic
```

### Pull Request Process
1. Create feature branch
2. Make changes
3. Test locally
4. Commit with descriptive messages
5. Push to GitHub
6. Create Pull Request
7. Request review
8. Merge after approval

## Deployment

### Preview Deployments
Every PR automatically gets a preview deployment on Cloudflare Pages.

### Production Deployment
Push to `main` branch:
```bash
git push origin main
```

Cloudflare automatically builds and deploys.

## Resources

### Documentation
- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers)
- [WHMCS API Docs](https://developers.whmcs.com/api/)
- [Vite Docs](https://vitejs.dev)

### Tools
- [VS Code](https://code.visualstudio.com)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler)
- [React DevTools](https://react.dev/learn/react-developer-tools)

### Internal Resources
- WRLD.host WHMCS: https://wrld.host/admin
- Cloudflare Dashboard: https://dash.cloudflare.com
- GitHub Repo: https://github.com/WRLDInc/wrld.domains_quick

## Getting Help

- Check this documentation first
- Review existing code for examples
- Search GitHub issues
- Contact WRLD Inc development team
- Reference WHMCS API documentation

---

Happy coding!
