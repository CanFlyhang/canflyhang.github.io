/**
 * 顶部导航交互脚本
 * 功能：汉堡菜单开合、背景音乐开关、外部点击/Esc 关闭
 */
(function () {
    'use strict';

    var hamburger = document.querySelector('.hamburger');
    var navLinks = document.querySelector('.nav-links');
    var musicToggle = document.getElementById('musicToggle');
    var bgAudio = document.getElementById('bgAudio');
    var ipStage = document.querySelector('.ip-stage');
    var ipViewer = document.getElementById('ipViewer');
    var stageFill = document.getElementById('stageFill');
    var stagePercent = document.getElementById('stagePercent');

    /**
     * 初始化汉堡菜单（移动端）：点击切换展开态，同步 aria 与按钮图标
     */
    function initHamburger() {
        hamburger.addEventListener('click', function () {
            var isOpen = navLinks.classList.toggle('is-open');
            hamburger.classList.toggle('is-active', isOpen);
            hamburger.setAttribute('aria-expanded', String(isOpen));
            hamburger.setAttribute('aria-label', isOpen ? '关闭导航菜单' : '打开导航菜单');
        });
    }

    /**
     * 初始化背景音乐开关
     * 开启：播放音频并切换为律动态；关闭：暂停并复位图标态
     * 无音源（如 bgm.mp3 缺失）时按钮状态仍可切换，不报错
     */
    function initMusicToggle() {
        musicToggle.addEventListener('click', function () {
            var turnOn = !musicToggle.classList.contains('is-on');
            setMusicState(turnOn);
        });

        // 音频自然结束/异常时复位按钮（loop 模式下兜底）
        bgAudio.addEventListener('ended', function () {
            setMusicState(false);
        });
        bgAudio.addEventListener('error', function () {
            // 音源缺失：保持视觉开关可用，但不尝试重复播放
        });
    }

    /**
     * 设置背景音乐播放状态
     * @param {boolean} on - true 播放 / false 暂停
     */
    function setMusicState(on) {
        musicToggle.classList.toggle('is-on', on);
        musicToggle.setAttribute('aria-pressed', String(on));
        musicToggle.setAttribute('aria-label', on ? '关闭背景音乐' : '播放背景音乐');

        if (on) {
            // play() 返回 Promise，无音源时静默失败
            var playPromise = bgAudio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(function () { /* 音源未就绪时忽略 */ });
            }
        } else {
            bgAudio.pause();
        }
    }

    /**
     * 窗口从移动端宽度恢复到桌面端时，重置汉堡/折叠面板状态，
     * 避免回到桌面后链接仍隐藏在 is-open 之外的异常态
     */
    function initResizeReset() {
        window.addEventListener('resize', function () {
            if (window.innerWidth >= 768) {
                navLinks.classList.remove('is-open');
                hamburger.classList.remove('is-active');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    /**
     * 初始化 3D 模型趣味加载层
     * 严格绑定 model-viewer 的真实加载事件：
     * - progress：下载进行中，显示加载层并按 totalProgress(0~1) 更新进度条/百分比
     * - load：模型就绪，进度补满 100% 后从容淡出
     * - error：加载失败也隐藏加载层，避免提示永久卡住
     */
    function initStageLoading() {
        if (!ipStage || !ipViewer) return;

        // 模型已缓存且在脚本绑定前就绪：不再显示加载层
        if (ipViewer.loaded) {
            updateStageProgress(1);
            ipStage.classList.add('is-loaded');
            return;
        }

        ipViewer.addEventListener('progress', function (e) {
            var progress = e.detail && typeof e.detail.totalProgress === 'number'
                ? e.detail.totalProgress : 0;

            // 已加载完成后（load 事件后可能还会有 progress=1 事件）不再重新显示
            if (ipStage.classList.contains('is-loaded')) return;

            ipStage.classList.add('is-loading');
            updateStageProgress(progress);
        });

        ipViewer.addEventListener('load', function () {
            updateStageProgress(1);
            ipStage.classList.remove('is-loading');
            ipStage.classList.add('is-loaded');
        });

        ipViewer.addEventListener('error', function () {
            ipStage.classList.remove('is-loading');
            ipStage.classList.add('is-loaded');
        });
    }

    /* ====== 第五屏：科技项目 3D 模型加载监听 ====== */
    var techModel = document.querySelector('.tech-model model-viewer');
    if (techModel) {
        var techProgress = techModel.querySelector('.model-progress');
        var techProgressText = techModel.querySelector('.model-progress-text');

        techModel.addEventListener('progress', function (e) {
            var progress = e.detail && typeof e.detail.totalProgress === 'number'
                ? e.detail.totalProgress : 0;
            if (techProgress) {
                techProgress.value = Math.round(progress * 100);
            }
            if (techProgressText) {
                techProgressText.textContent = Math.round(progress * 100) + '%';
            }
        });

        techModel.addEventListener('load', function () {
            techModel.classList.add('loaded');
        });

        techModel.addEventListener('error', function () {
            techModel.classList.add('loaded');
        });
    }

    /**
     * 更新加载层进度条宽度与百分比文本
     * @param {number} progress - 0~1 的加载进度
     */
    function updateStageProgress(progress) {
        if (!stageFill || !stagePercent) return;
        var percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
        stageFill.style.width = percent + '%';
        stagePercent.textContent = percent + '%';
    }

    /**
     * 第二屏滚动显现：
     * - .reveal 元素进入视口时添加 .in-view，触发上浮淡入
     * - .ability-map 进入视口时添加 .in-view，触发连线绘制与圆点点亮
     * 使用 IntersectionObserver，仅在首次进入时触发一次
     */
    function initScrollReveal() {
        var targets = document.querySelectorAll('.reveal, .ability-map');
        var sections = document.querySelectorAll('.about-section, .experience-section, .projects-section, .tech-section, .cognition-section, .social-section, .contact-section');
        if (!targets.length && !sections.length) return;

        // 不支持 IO 的老旧浏览器：直接全部显示，避免内容永久不可见
        if (!('IntersectionObserver' in window)) {
            targets.forEach(function (el) { el.classList.add('in-view'); });
            sections.forEach(function (el) { el.classList.add('in-view'); });
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    io.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.18,
            rootMargin: '0px 0px -8% 0px'
        });

        targets.forEach(function (el) { io.observe(el); });

        /* 整屏 section（如第二屏）可能远高于视口，交叉比例天然偏小，
           用独立低阈值观察器：顶部进入视口 15% 即触发画框淡入 */
        var ioSection = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    ioSection.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });

        sections.forEach(function (el) { ioSection.observe(el); });
    }

    /**
     * 首屏装饰退场：滚动超过首屏 35% 高度后，
     * 给 body 加 .past-hero，由 CSS 将 3D 模型/照片墙/GIF 淡出；
     * 滚回首屏时恢复显示。rAF 节流，避免滚动事件高频触发
     */
    function initHeroDismiss() {
        var ticking = false;

        function update() {
            var threshold = window.innerHeight * 0.35;
            document.body.classList.toggle('past-hero', window.scrollY > threshold);
            ticking = false;
        }

        window.addEventListener('scroll', function () {
            if (!ticking) {
                ticking = true;
                window.requestAnimationFrame(update);
            }
        }, { passive: true });

        update();   // 初始化（页面刷新保留滚动位置时也能正确响应）
    }

    document.addEventListener('DOMContentLoaded', function () {
        initHamburger();
        initMusicToggle();
        initResizeReset();
        initStageLoading();
        initScrollReveal();
        initHeroDismiss();
    });
})();
