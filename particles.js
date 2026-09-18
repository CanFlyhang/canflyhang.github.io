/**
 * 浮动粒子背景系统
 * - 粒子随机漂浮，平滑运动轨迹
 * - 鼠标位置检测，附近粒子产生吸引力
 * - 响应式自适应屏幕尺寸
 * - requestAnimationFrame 优化性能
 * - pointer-events: none，不影响任何页面交互
 */
(function () {
    'use strict';

    /* ========== 可配置参数（可按需调整） ========== */
    const CONFIG = {
        particleCount: 60,          // 粒子数量（桌面端）
        particleCountMobile: 28,    // 粒子数量（移动端，性能优先）
        minSize: 1.5,               // 最小粒子半径
        maxSize: 4,                 // 最大粒子半径
        minSpeed: 0.15,             // 最小漂浮速度
        maxSpeed: 0.5,              // 最大漂浮速度
        colors: [                   // 粒子颜色池（褐黄色系，呼应全站调性）
            { r: 184, g: 144, b: 63 },   // #b8903f 赭黄
            { r: 212, g: 175, b: 95 },   // #d4af5f 米金
            { r: 240, g: 200, b: 120 },  // #f0c878 浅金
            { r: 120, g: 90, b: 30 }     // #785a1e 深褐
        ],
        minOpacity: 0.25,          // 最小透明度
        maxOpacity: 0.7,           // 最大透明度
        mouseInfluence: 180,       // 鼠标影响半径（像素）
        mouseForce: 0.8,           // 鼠标吸引力强度
        friction: 0.96,            // 摩擦系数（运动平滑衰减）
        linkDistance: 120,         // 连线最大距离（小于此值时粒子间画连线）
        linkOpacity: 0.15,         // 连线透明度
        linkColor: { r: 184, g: 144, b: 63 }  // 连线颜色
    };

    /* ========== 全局状态 ========== */
    let canvas, ctx;
    let width = 0, height = 0;
    let particles = [];
    let mouse = { x: -9999, y: -9999, active: false };
    let rafId = null;
    let dpr = Math.min(window.devicePixelRatio || 1, 2); // 限制 DPR 防止性能问题

    /**
     * 工具：范围随机数
     * @param {number} min 下限
     * @param {number} max 上限
     * @returns {number}
     */
    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * 粒子类：单个粒子的位置、速度、外观与行为
     */
    class Particle {
        constructor() {
            this.reset(true);
        }

        /**
         * 初始化或重置粒子状态
         * @param {boolean} initial 是否首次初始化（决定是否随机分布位置）
         */
        reset(initial) {
            this.x = initial ? rand(0, width) : (Math.random() < 0.5 ? -10 : width + 10);
            this.y = initial ? rand(0, height) : rand(0, height);
            this.size = rand(CONFIG.minSize, CONFIG.maxSize);
            this.baseSpeed = rand(CONFIG.minSpeed, CONFIG.maxSpeed);
            const angle = rand(0, Math.PI * 2);
            this.vx = Math.cos(angle) * this.baseSpeed;
            this.vy = Math.sin(angle) * this.baseSpeed;
            const color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
            this.opacity = rand(CONFIG.minOpacity, CONFIG.maxOpacity);
            // 用于呼吸式透明度变化
            this.opacityPhase = rand(0, Math.PI * 2);
            this.opacitySpeed = rand(0.005, 0.015);
        }

        /**
         * 更新粒子位置与状态
         * - 基础漂浮
         * - 鼠标吸引力
         * - 边界回环
         */
        update() {
            // 鼠标吸引力（距离越近，作用越强）
            if (mouse.active) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONFIG.mouseInfluence && dist > 0.1) {
                    const force = (1 - dist / CONFIG.mouseInfluence) * CONFIG.mouseForce;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                }
            }

            // 摩擦衰减，防止速度无限增长
            this.vx *= CONFIG.friction;
            this.vy *= CONFIG.friction;

            // 速度下限保护：避免完全静止
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed < CONFIG.minSpeed) {
                const angle = rand(0, Math.PI * 2);
                this.vx = Math.cos(angle) * CONFIG.minSpeed;
                this.vy = Math.sin(angle) * CONFIG.minSpeed;
            }

            // 速度上限保护：防止鼠标快速划过时粒子飞出
            const maxV = CONFIG.maxSpeed * 2.5;
            if (speed > maxV) {
                this.vx = (this.vx / speed) * maxV;
                this.vy = (this.vy / speed) * maxV;
            }

            this.x += this.vx;
            this.y += this.vy;

            // 边界回环：从一侧消失，从另一侧出现
            if (this.x < -10) this.x = width + 10;
            if (this.x > width + 10) this.x = -10;
            if (this.y < -10) this.y = height + 10;
            if (this.y > height + 10) this.y = -10;

            // 透明度呼吸变化
            this.opacityPhase += this.opacitySpeed;
        }

        /**
         * 绘制粒子（圆形 + 软发光）
         */
        draw() {
            const breathOpacity = this.opacity * (0.7 + 0.3 * Math.sin(this.opacityPhase));
            const r = Math.max(0.5, this.size);

            // 软发光：径向渐变模拟粒子光晕
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.5);
            gradient.addColorStop(0, `rgba(${this.r},${this.g},${this.b},${breathOpacity})`);
            gradient.addColorStop(0.5, `rgba(${this.r},${this.g},${this.b},${breathOpacity * 0.4})`);
            gradient.addColorStop(1, `rgba(${this.r},${this.g},${this.b},0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * 绘制粒子之间的连线（距离小于阈值时）
     */
    function drawLinks() {
        const lc = CONFIG.linkColor;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i];
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONFIG.linkDistance) {
                    const alpha = (1 - dist / CONFIG.linkDistance) * CONFIG.linkOpacity;
                    ctx.strokeStyle = `rgba(${lc.r},${lc.g},${lc.b},${alpha})`;
                    ctx.lineWidth = 0.6;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }
    }

    /**
     * 主渲染循环
     */
    function render() {
        ctx.clearRect(0, 0, width, height);
        drawLinks();
        for (const p of particles) {
            p.update();
            p.draw();
        }
        rafId = requestAnimationFrame(render);
    }

    /**
     * 初始化 Canvas 尺寸（考虑 DPR 与响应式粒子数量）
     */
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置变换
        ctx.scale(dpr, dpr);

        // 响应式粒子数量
        const targetCount = width < 768 ? CONFIG.particleCountMobile : CONFIG.particleCount;
        while (particles.length < targetCount) particles.push(new Particle());
        if (particles.length > targetCount) particles.length = targetCount;
    }

    /**
     * 鼠标位置更新
     */
    function onMouseMove(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    }

    /**
     * 鼠标离开：停止吸引
     */
    function onMouseLeave() {
        mouse.active = false;
        mouse.x = -9999;
        mouse.y = -9999;
    }

    /**
     * 触摸位置更新（移动端支持）
     */
    function onTouchMove(e) {
        if (e.touches.length > 0) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
            mouse.active = true;
        }
    }

    /**
     * 触摸结束：停止吸引
     */
    function onTouchEnd() {
        mouse.active = false;
        mouse.x = -9999;
        mouse.y = -9999;
    }

    /**
     * 可见性变化时暂停/恢复渲染（节省后台标签页性能）
     */
    function onVisibilityChange() {
        if (document.hidden) {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        } else {
            if (!rafId) render();
        }
    }

    /**
     * 防抖式 resize 监听
     */
    let resizeTimer = null;
    function onResize() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    }

    /**
     * 入口：初始化粒子系统
     */
    function init() {
        canvas = document.getElementById('particleCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        if (!ctx) return;

        resize();
        render();

        // 事件绑定（passive 提升滚动性能）
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('mouseleave', onMouseLeave);
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        document.addEventListener('visibilitychange', onVisibilityChange);
    }

    // DOM 就绪后启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
