import { describe, it, expect } from 'vitest';
import { getLanguageFromPath } from '../../src/utils/file-lang-map';

describe('getLanguageFromPath', () => {
  it('returns typescript for .ts files', () => {
    expect(getLanguageFromPath('src/app.ts')).toBe('typescript');
  });

  it('returns python for .py files', () => {
    expect(getLanguageFromPath('main.py')).toBe('python');
  });

  it('returns bash for .sh files', () => {
    expect(getLanguageFromPath('script.sh')).toBe('bash');
  });

  it('returns json for .json files', () => {
    expect(getLanguageFromPath('data.json')).toBe('json');
  });

  it('returns xml for .html files', () => {
    expect(getLanguageFromPath('page.html')).toBe('xml');
  });

  it('returns css for .css files', () => {
    expect(getLanguageFromPath('styles.css')).toBe('css');
  });

  it('returns markdown for .md files', () => {
    expect(getLanguageFromPath('README.md')).toBe('markdown');
  });

  it('returns yaml for .yml files', () => {
    expect(getLanguageFromPath('config.yml')).toBe('yaml');
  });

  it('returns go for .go files', () => {
    expect(getLanguageFromPath('main.go')).toBe('go');
  });

  it('returns rust for .rs files', () => {
    expect(getLanguageFromPath('lib.rs')).toBe('rust');
  });

  it('returns sql for .sql files', () => {
    expect(getLanguageFromPath('query.sql')).toBe('sql');
  });

  it('returns xml for .vue files', () => {
    expect(getLanguageFromPath('component.vue')).toBe('xml');
  });

  it('returns bash for Makefile', () => {
    expect(getLanguageFromPath('Makefile')).toBe('bash');
  });

  it('returns bash for Dockerfile', () => {
    expect(getLanguageFromPath('Dockerfile')).toBe('bash');
  });

  it('returns bash for .env', () => {
    expect(getLanguageFromPath('.env')).toBe('bash');
  });

  it('returns bash for .gitignore', () => {
    expect(getLanguageFromPath('.gitignore')).toBe('bash');
  });

  it('returns undefined for extensionless files without filename match', () => {
    expect(getLanguageFromPath('noextension')).toBeUndefined();
  });

  it('returns undefined for unknown extensions', () => {
    expect(getLanguageFromPath('file.xyz')).toBeUndefined();
  });

  it('returns typescript for .tsx in deep paths', () => {
    expect(getLanguageFromPath('/deep/nested/path/file.tsx')).toBe('typescript');
  });

  it('returns javascript for .js files', () => {
    expect(getLanguageFromPath('index.js')).toBe('javascript');
  });

  it('returns javascript for .jsx files', () => {
    expect(getLanguageFromPath('App.jsx')).toBe('javascript');
  });

  it('returns yaml for .yaml files', () => {
    expect(getLanguageFromPath('docker-compose.yaml')).toBe('yaml');
  });

  it('returns xml for .xml files', () => {
    expect(getLanguageFromPath('pom.xml')).toBe('xml');
  });

  it('returns xml for .svg files', () => {
    expect(getLanguageFromPath('logo.svg')).toBe('xml');
  });
});
