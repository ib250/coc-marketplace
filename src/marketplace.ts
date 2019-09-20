import { BasicList, commands, extensions, fetch, ListContext, ListItem, Neovim, workspace } from 'coc.nvim';

interface IExtension {
  name: string;
  label: string;
  homepage: string;
  installed: boolean;
}

export default class Marketplace extends BasicList {
  public readonly name = 'marketplace';
  public readonly description = 'coc.nvim extensions marketplace';
  public readonly detail = 'display all coc.nvim extensions in list, with an install action';
  public readonly defaultAction = 'install';

  constructor(nvim: Neovim) {
    super(nvim);

    this.addAction('install', async item => {
      await nvim.command(`CocInstall ${item.data.name}`);
    });

    this.addAction('uninstall', async item => {
      if (!item.data.installed) {
        return;
      }
      await nvim.command(`CocUninstall ${item.data.name}`);
    });

    this.addAction('homepage', async item => {
      if (item.data.homepage) {
        commands.executeCommand('vscode.open', item.data.homepage).catch(_e => {
          // noop
        });
      }
    });
  }

  public async loadItems(context: ListContext): Promise<ListItem[]> {
    const { args } = context;
    let query = '';
    if (args && args.length > 0) {
      for (const arg of args) {
        if (arg.startsWith('--')) {
          continue;
        }

        query = arg;
      }
    }

    let items: ListItem[] = [];
    const exts = await this.fetchExtensions();
    for (const ext of exts) {
      if (query && query.length > 0) {
        if (ext.name.indexOf(query) < 0) {
          continue;
        }
      }

      items.push({
        label: ext.label,
        data: {
          installed: ext.installed,
          homepage: ext.homepage,
          name: ext.name
        }
      });
    }
    items.sort((a, b) => {
      return b.label.localeCompare(a.label);
    });

    return items;
  }

  async fetchExtensions(): Promise<IExtension[]> {
    let statusItem = workspace.createStatusBarItem(0, { progress: true });
    statusItem.text = 'Loading...';
    statusItem.show();

    const uri = 'http://registry.npmjs.com/-/v1/search?text=keywords:coc.nvim&size=200';

    const resp = await fetch(uri);
    statusItem.hide();

    const body = typeof resp === 'string' ? JSON.parse(resp) : resp;
    const exts = this.format(body);

    return Promise.resolve(exts);
  }

  private format(body: any): IExtension[] {
    // TODO check body.total for paging
    let exts: IExtension[] = [];
    for (const item of body.objects) {
      let pkg = item.package;
      if (pkg.name === 'coc.nvim' || pkg.name === 'coc-marketplace') {
        continue;
      }

      let sign = '';
      if (pkg.publisher.username === 'chemzqm' || pkg.publisher.email === 'chemzqm@gmail.com') {
        sign = '*';
      }

      let status = '×';
      let isInstalled = false;
      for (const e of extensions.all) {
        if (e.id === pkg.name) {
          status = '√';
          isInstalled = true;
          break;
        }
      }

      exts.push({
        name: pkg.name,
        label: `[${status}] ${pkg.name}${sign} ${pkg.version}`.padEnd(40) + pkg.description,
        homepage: pkg.links.homepage ? pkg.links.homepage : pkg.links.npm,
        installed: isInstalled
      });
    }

    return exts;
  }

  public doHighlight(): void {
    let { nvim } = this;
    nvim.pauseNotification();
    nvim.command('syntax match CocMarketplaceExtName /\\v%5v\\S+/', true);
    nvim.command('syntax match CocMarketplaceExtStatus /\\v^\\[[√×\\*]\\]/', true);
    nvim.command('syntax match CocMarketplaceExtVersion /\\v\\d+(\\.\\d+)*/', true);
    nvim.command('syntax match CocMarketplaceExtDescription /\\v%40v.*$/', true);
    nvim.command('highlight default link CocMarketplaceExtName String', true);
    nvim.command('highlight default link CocMarketplaceExtStatus Type', true);
    nvim.command('highlight default link CocMarketplaceExtVersion Tag', true);
    nvim.command('highlight default link CocMarketplaceExtDescription Comment', true);
    nvim.resumeNotification().catch(_e => {
      // noop
    });
  }
}
