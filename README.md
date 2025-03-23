# aisimulator
An AI Driven Visual Novel - mimicking renpy but built on next.js

This requires 2 containers to run, one Flask OpenAI Proxy and the other Next.JS front end.

## OpenAI Only Supported
This app does not support Azure OpenAI at this point

You will need the environment variable `OPENAI_API_KEY` set so it connects to OpenAI

## Backend API Container
You'll need to specify the `NEXT_PUBLIC_API_URL` envirnoment variable so that the Next.JS frontend knows where to direct API calls to
