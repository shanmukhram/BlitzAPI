import { createApp } from './src/index.js';

console.log('\n🧪 Testing Smart Adapter Selection\n');

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'Smart adapter working!' });
});

app.listen(3000).then(() => {
  console.log('\n✅ Server started successfully!');
  console.log('Test with: curl http://localhost:3000/');
});
