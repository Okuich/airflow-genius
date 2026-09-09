# FlowDynamics Hub

You are building a production-grade SaaS CFD platform for small HVAC OEMs and fan/blower manufacturers.

Tech constraints:
- Frontend: React 18 + TypeScript
- Backend: Node.js + TypeScript (Express or Fastify)
- Cloud-native architecture
- Modular, scalable, production-ready
- Strict typing (no any)
- Domain-driven folder structure
- Clean architecture principles

Core capabilities:
- Navier-Stokes solver orchestration
- RANS turbulence modeling (k-epsilon, SST)
- Rotating reference frame for fans/blowers
- Heat transfer simulation
- AI Agent that resolves 95% of user issues

Generate code in isolated modules.
Provide full interfaces and type definitions.
Include validation schemas (Zod).
Use async/await.
Assume containerized deployment.

Do NOT produce pseudo code.
Produce real TypeScript scaffolding.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://airflow-genius.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a801631b-f5ee-467a-8347-ecf19e25ab56).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
