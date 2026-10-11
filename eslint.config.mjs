import antfu from '@antfu/eslint-config'
import tsdoc from 'eslint-plugin-tsdoc'

/**
 * ESLint 只负责「正确性」，不介入代码风格：TS/JS 由人工排版，prettier 只管 json/yaml
 * （见 package.json 的 format 脚本与 .prettierignore 里的说明）。
 *
 * 项目已经很久没跑 lint：用 @antfu 默认配置会报大量问题，其中绝大多数是纯风格问题
 * （style/semi、style/indent、perfectionist/sort-* …）。为了让 diff 可控，这里整体关闭
 * 风格类与教条类插件层，只保留指向真实 bug 的核心规则。
 * 想重新启用某一层，把对应的 `false` 改成 `true` 即可。
 */
const config = await antfu({
  gitignore: true,
  ignores: [
    'web/**',
    'docs/**',
    'dist/**',
    '.cache/**',
  ],

  // 风格类规则不启用（TS/JS 由人工排版，避免制造无意义 diff）
  stylistic: false,
  // 以下插件层对历史代码噪音太大，先整体关闭
  regexp: false,
  unicorn: false,
  test: false,
  imports: false,
  jsonc: false,
  yaml: false,
  toml: false,
  markdown: false,
}, {
  plugins: { tsdoc },
  rules: {
    'tsdoc/syntax': 'off',
    'antfu/no-top-level-await': 'off', // 测试文件里 top-level await 是正常写法

    // 偏好类：不产生真实 bug，也不制造 diff
    'prefer-const': 'off',
    'prefer-template': 'off',
    'object-shorthand': 'off',
    'no-cond-assign': 'off', // 沿用旧配置：`while ((m = re.exec(s)))` 是惯用写法
    'no-lone-blocks': 'off', // `case 'x': { … }; break;` 的花括号是刻意的
    'unused-imports/no-unused-vars': 'off', // 未使用的函数参数多是签名占位

    // TS 风格类
    'ts/consistent-type-imports': 'off',
    'ts/consistent-type-definitions': 'off',
    'ts/no-use-before-define': 'off',
    'ts/ban-ts-comment': 'off',
    'ts/no-redeclare': 'off', // `const X` + `type X` 是有意的同名合并
    'ts/no-unsafe-function-type': 'off', // `Function` 是历史写法，换成签名写法只产生噪音 diff
    'ts/no-import-type-side-effects': 'off',

    // 写法偏好类：与正确性无关
    'prefer-arrow-callback': 'off', // 测试里 `it('x', function () {})` 是既有风格
    'prefer-spread': 'off',
    'dot-notation': 'off', // 测试里 `obj["counter"]` 与断言文本对齐，更易读
  },
}, {
  // 脚本、示例与测试需要 console；src/ 里仍然禁止（当前为零处）
  files: ['**/*.mjs', '**/*.mts', 'test/**', 'examples/**'],
  rules: {
    'no-console': 'off',
  },
})

// ESLint 9 的 rules 通配符（如 `perfectionist/*`）只在 global config 生效，这里手动关掉整组噪音规则
const NOISE_GROUPS = ['perfectionist/', 'jsdoc/', 'node/', 'import/']
for (const item of config) {
  if (!item.rules) { continue }
  for (const name of Object.keys(item.rules)) {
    if (NOISE_GROUPS.some(group => name.startsWith(group))) {
      item.rules[name] = 'off'
    }
  }
}

export default config
