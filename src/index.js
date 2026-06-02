import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './routes/apiRoutes.js';

// 根据环境加载不同的配置文件
const env = process.env.NODE_ENV || 'development';
console.log(`正在加载 ${env} 环境配置...`);

// 尝试加载特定环境的配置文件
dotenv.config({ path: `.env.${env}` });

// 如果特定环境的配置文件不存在，则加载默认配置
if (!process.env.NETWORK) {
    dotenv.config();
}

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '10mb' })); // 增加请求体大小限制以支持加密数据

// 注册API路由
app.use('/', apiRoutes);

// 启动服务器
app.listen(port, () => {
    console.log(`SUI 转账服务运行在端口 ${port}`);
    console.log(`当前环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`健康检查: http://localhost:${port}/health`);
});

export default app;