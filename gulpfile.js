const gulp = require('gulp');
const sass = require('gulp-sass');
const replace = require('gulp-replace');
const rename = require('gulp-rename');
const tap = require('gulp-tap');
const clean = require('gulp-clean');
const babel = require('gulp-babel');
const gulpSequence = require('gulp-sequence');
const path = require('path');
const webpack = require('webpack');
const fs = require('fs');
const webpackStream = require('webpack-stream');

const config = require('./build/config');

const hasRmCssFiles = new Set();


// TODO sprity、js、remove、环境配置（dev,prod,sourcemap等）

const getAssetsExt = () => {
    const extsLow = config.assetsExt.concat(['json', 'wxml', 'wxs']);
    const extsUp = extsLow.map(item => item.toUpperCase());
    const exts = extsLow.concat(extsUp);
    return exts.join(',');
};

const getEntries = (dir) => {
    let files = [];
    const src = path.resolve(dir);
    const srcFile = fs.readdirSync(src);
    srcFile.forEach((item) => {
        const filePath = path.resolve(dir, item);
        const isDir = fs.lstatSync(filePath).isDirectory();
        if (/\.js$/.test(item)) {
            files.push(filePath);
        } else if (isDir) {
            files = files.concat(getEntries(filePath));
        }
    });
    return files;
};

gulp.task('js', () => {
    const mode = config.jsCompileMode;
    if (mode === 'webpack') {
        const srcPath = path.resolve('./src');
        const entries = getEntries(srcPath);
        const entriesObj = {};
        entries.forEach((entry) => {
            const entryPath = entry.replace(`${srcPath}/`, '');
            entriesObj[entryPath] = entry;
        });
        return gulp.src([])
            .pipe(webpackStream({
                entry: entriesObj,
                output: {
                    filename: '[name]',
                },
                module: {
                    loaders: [{
                        test: /\.js$/,
                        exclude: /node_modules/,
                        loader: 'babel-loader',
                    }],
                },
            }))
            .pipe(gulp.dest('./dist'));
    }
    return gulp.src('./src/**/*.js')
        .pipe(babel({
            babelrc: false,
            presets: ['es2015', 'stage-0'],
        }))
        .pipe(gulp.dest('./dist'));
});


gulp.task('sass', () => gulp.src('./src/**/*.{scss,wxss}')
    .pipe(tap((file) => {
        // 当前处理文件的路径
        const filePath = path.dirname(file.path);
        // 当前处理内容
        const content = file.contents.toString();
        // 找到import的scss，并匹配是否在配置文件中
        content.replace(/@import\s+['|"](.+)['|"];/g, ($1, $2) => {
            const hasImport = config.cssFilterFiles.filter(item => $2.indexOf(item) > -1);
            // hasImport > 0表示import的文件在配置文件中，打包完成后需要删除
            if (hasImport.length > 0) {
                const rmPath = path.join(filePath, $2);
                // 将src改为dist，.scss改为.wxss，例如：'/xxx/src/scss/const.scss' => '/xxx/dist/scss/const.wxss'
                const filea = rmPath.replace(/src/, 'dist').replace(/\.scss/, '.wxss');
                // 加入待删除列表
                hasRmCssFiles.add(filea);
            }
        });
        console.log('rm', hasRmCssFiles);
    }))
    .pipe(replace(/(@import.+;)/g, ($1, $2) => {
        const hasImport = config.cssFilterFiles.filter(item => $1.indexOf(item) > -1);
        if (hasImport.length > 0) {
            return $2;
        }
        return `/** ${$2} **/`;
    }))
    .pipe(sass().on('error', sass.logError))
    .pipe(replace(/(\/\*\*\s{0,})(@.+)(\s{0,}\*\*\/)/g, ($1, $2, $3) => $3.replace(/\.scss/g, '.wxss')))
    .pipe(rename({
        extname: '.wxss',
    }))
    .pipe(gulp.dest('./dist')));

gulp.task('clean:wxss', () => {
    const arr = [];
    hasRmCssFiles.forEach((item) => {
        arr.push(item);
    });
    return gulp.src(arr, { read: false })
        .pipe(clean({ force: true }));
});

// 清除目录
gulp.task('clean', () => {
    const distPath = path.resolve('./dist');
    return gulp.src(distPath, { read: false })
        .pipe(clean({ force: true }));
});

// 做成可配置的后缀
gulp.task('assets', () => {
    const exts = getAssetsExt();
    return gulp.src(`./src/**/*.{${exts}}`).pipe(gulp.dest('./dist'));
});

gulp.task('watch', () => {
    const exts = getAssetsExt();
    gulp.watch('./src/**/*.js', ['js']);
    gulp.watch('./src/**/*.{scss,wxss}', ['sass', 'clean:wxss']);
    gulp.watch(`./src/**/*.{${exts}}`, ['assets']);
});

gulp.task('default', gulpSequence(['clean'], ['assets', 'js', 'sass'], ['clean:wxss']));
