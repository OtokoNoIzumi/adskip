module.exports = {
  content: [
    './**/*.html',
    './**/*.js',
    './popup.html',
    './content.js',
    './ui-components.js'
  ],
  theme: {
    extend: {
      colors: {
        'bilibili-pink': '#FB7299',
        'bilibili-pink-hover': '#e05c83',
        'bilibili-blue': '#00a0d8',
        'bilibili-blue-hover': '#007bb5',
      },
      boxShadow: {
        'button': '0 2px 5px rgba(0,0,0,0.1)',
        'panel': '0 4px 20px rgba(0,0,0,0.15)',
        'admin-panel': '0 4px 25px rgba(0,0,0,0.25)',
      },
    },
  },
  safelist: [
    // 手动添加可能被动态生成但编译时检测不到的类
    'fixed', 'top-[100px]', 'right-5', 'py-2', 'px-3', 'bg-bilibili-pink', 'text-white',
    'rounded', 'shadow-lg', 'cursor-pointer', 'text-sm', 'z-[10000]',
    'w-80', 'p-4', 'm-0', 'bg-gray-50', 'font-sans', 'text-bilibili-pink',
    'flex', 'items-center', 'mb-4', 'w-9', 'h-9', 'mr-2.5', 'text-lg', 'font-bold',
    'hover:bg-bilibili-pink-hover', 'shadow-button', 'shadow-panel', 'shadow-admin-panel'
  ],
  plugins: [],
  corePlugins: {
    container: false,
  },
  // 启用任意值
  future: {
    hoverOnlyWhenSupported: true,
  },
  // 开启JIT模式
  mode: 'jit'
}