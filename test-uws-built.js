import { createApp } from './dist/index.js';

console.log('\n🧪 Testing Smart Adapter with Built Code\n');

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'uWebSockets working!', adapter: 'uwebsockets' });
});

app.listen(3000).then(() => {
  console.log('\n✅ Server started!');
  console.log('Test: curl http://localhost:3000/');
});
