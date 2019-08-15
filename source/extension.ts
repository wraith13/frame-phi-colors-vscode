import * as vscode from 'vscode';
import * as os from 'os';
import { phiColors } from 'phi-colors';

export module FramePhiColors
{
    const applicationKey = "framePhiColors";

    class Config<valueT>
    {
        public constructor
        (
            public name: string,
            public defaultValue: valueT,
            public validator?: (value: valueT) => boolean,
            public minValue?: valueT,
            public maxValue?: valueT
        )
        {

        }

        regulate = (rawKey: string, value: valueT): valueT =>
        {
            let result = value;
            if (this.validator && !this.validator(result))
            {
                // settings.json をテキストとして直接編集してる時はともかく GUI での編集時に無駄にエラー表示が行われてしまうので、エンドユーザーに対するエラー表示は行わない。
                //vscode.window.showErrorMessage(`${rawKey} setting value is invalid! Please check your settings.`);
                console.error(`${rawKey} setting value is invalid! Please check your settings.`);
                result = this.defaultValue;
            }
            else
            {
                if (undefined !== this.minValue && result < this.minValue)
                {
                    result = this.minValue;
                }
                else
                if (undefined !== this.maxValue && this.maxValue < result)
                {
                    result = this.maxValue;
                }
            }
            return result;
        }

        public get = (): valueT =>
        {
            let result = <valueT>vscode.workspace.getConfiguration(applicationKey)[this.name];
            if (undefined === result)
            {
                result = this.defaultValue;
            }
            else
            {
                result = this.regulate(`${applicationKey}.${this.name}`, result);
            }
            return result;
        }
    }
    const colorValidator = (value: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(value);
    const makeEnumValidator = (valueList: string[]): (value: string) => boolean => (value: string): boolean => 0 <= valueList.indexOf(value);
    const colorModeObject = Object.freeze({ "none": null, "hostname": null, "folder": null, });

    const activityBarColorEnabled = new Config("activityBarColorEnabled", true);
    const activityBarBaseColor = new Config("activityBarBaseColor", "#5679C9", colorValidator);
    const activityBarColorMode = new Config<keyof typeof colorModeObject>("activityBarColorMode", "hostname", makeEnumValidator(Object.keys(colorModeObject)));
    const statusBarColorEnabled = new Config("statusBarColorEnabled", true);
    const statusBarBaseColor = new Config("statusBarBaseColor", "#5679C9", colorValidator);
    const statusBarColorMode = new Config<keyof typeof colorModeObject>("statusBarColorMode", "folder", makeEnumValidator(Object.keys(colorModeObject)));

    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        console.log('Congratulations, your extension "frame-phi-colors" is now active!');

        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'extension.helloWorld', () =>
                {
                    vscode.window.showInformationMessage('Hello World!');
                }
            ),

            //  イベントリスナーの登録
            vscode.workspace.onDidChangeConfiguration(() => apply()),
            vscode.workspace.onDidChangeWorkspaceFolders(() => apply()),
        );

        apply();
    };

    const hash = (source: string): number =>
        source.split("").map(i => i.codePointAt(0) || 0).reduce((a, b) => (a *173 +b +((a & 0x5555) >>> 5)) & 8191)
        %34; // ← 通常、こういうところの数字は素数にすることが望ましいがここについては https://wraith13.github.io/phi-ratio-coloring/phi-ratio-coloring.htm で類似色の出てくる周期をベース(8,13,21,...)に調整すること。

    const getHostNameHash = (): number => hash(os.hostname());
    const getFolderHash = (): number => hash
    (
        vscode.workspace.workspaceFolders && 0 < vscode.workspace.workspaceFolders.length ?
            vscode.workspace.workspaceFolders[0].uri.toString():
            "null"
    );
     const generateColor = (baseColor: string, hash: number) => phiColors.rgbForStyle
    (
        phiColors.hslaToRgba
        (
            phiColors.generate
            (
                phiColors.rgbaToHsla(phiColors.rgbaFromStyle(baseColor)),
                hash,
                0,
                0,
                0
            )
        )
    );

    const makeColor = (baseColor: string, colorMode: keyof typeof colorModeObject) =>
    {
        switch(colorMode)
        {
        case "hostname":
            return generateColor(baseColor, getHostNameHash());
        case "folder":
            return generateColor(baseColor, getFolderHash());
        }
        return null;
    };

    const applyColor = (key: string, colorMode: keyof typeof colorModeObject, color: string | null) =>
    {
        switch(colorMode)
        {
        case "none":
            //removeGlobal;
            //removeLocal;
            break;
        case "hostname":
            //set Global;
            //removeLocal;
            break;
        case "folder":
            //removeGlobal;
            //set Local;
            break;
        }
    };

    const apply = () =>
    {
        const activityBarColorModeValue = activityBarColorMode.get();
        applyColor
        (
            "",
            activityBarColorModeValue,
            makeColor(activityBarBaseColor.get(), activityBarColorModeValue)
        );
    };
}

export function activate(context: vscode.ExtensionContext): void
{
    FramePhiColors.initialize(context);
}

export function deactivate(): void
{
}
