function resetTextbox() {
    
    document.getElementById("input_code").value = "";
    document.getElementById("result").textContent = "";
}

function runTranslation() {
    const API_URL = 'https://api-free.deepl.com/v2/translate';

    let substi_sets = {pre:"EQ", len_num: 2, cnt: 0};

    let equation_list = [];

    // 初期化
    let idx = 0;
    let idx_equation_start = 0;
    let idx_equation_end = 0;

    let equation = "";

    let is_inline_eq = false;

    let replaced_string = "";
    let replaced_equation_list = [];

    let r = [];
    
    let api_elm = document.getElementById("deepl_api_key");
    const API_KEY = api_elm.value;

    let have_api_key = API_KEY != "";

    if (have_api_key) {
        document.getElementById("warning_api_key").style.display = "none";

        if (api_elm.classList.contains("is-danger")) {

            api_elm.classList.remove("is-danger");
            api_elm.classList.add("is-info");
            api_elm.style.backgroundColor = "white";

        }        

    } else {

        document.getElementById("warning_api_key").style.display = "block";
        document.getElementById('warning_api_key').innerHTML = "<a href='https://www.deepl.com/pro#developer'>このリンク</a>からDeepLのAPIキーを取得し，右上の欄に入力してください．";

        api_elm.classList.remove("is-info");
        api_elm.classList.add("is-danger");
        api_elm.style.backgroundColor = "#ffecf4";
        
        document.getElementById('result').textContent = "";

        return;

    }

    let original_latex_code = document.getElementById("input_code").value;

    let latex_code = preprocessLatexCode(original_latex_code);

    // コロンとセミコロンが文章内にあるかをチェックし、ある場合警告を出す。
    checkColonSemicolon(latex_code);

    // 数式を一旦equation_listに保管して，EQxxで置き換える
    // 置換後のテキストはsubsti_code_listに入れる
    while (true) {

        r = extractFirstEquation(latex_code.slice(idx));
        [equation, is_inline_eq, idx_equation_start, idx_equation_end] = r;
        idx_equation_start = idx_equation_start + idx;
        idx_equation_end   = idx_equation_end + idx;

        if (equation == ""){
            break;
        }

        equation = changeEquationForMathjax(equation, is_inline_eq);

        [replaced_string, replaced_equation_list] = replaceEquationWithSubsti(equation, is_inline_eq, substi_sets);

        equation_list = equation_list.concat(replaced_equation_list);

        latex_code = latex_code.slice(0, idx_equation_start) + replaced_string + latex_code.slice(idx_equation_end + 1);

        idx = idx_equation_start + replaced_string.length;
    }

    // 翻訳
    let url = API_URL + '?' + encodeURI('auth_key=' + API_KEY + '&text=' + latex_code + '&source_lang=EN&target_lang=JA');
  
    fetch(url)
        .then(function(response) {
            if (response.ok) {
                return response.json();
            } else {

                document.getElementById("warning_api_key").style.display = "block";
                document.getElementById('warning_api_key').innerHTML = "DeepL APIにアクセスできません。以下の内容についてチェックしてください。<ul><li>APIキーが正確か→<a href='https://www.deepl.com/ja/account/summary'>アカウント</a></li><li>利用可能文字数が最大に達していないか→<a href='https://www.deepl.com/ja/account/usage'>ご利用状況</a></li><li>インターネットが正しく接続されているか</li></ul>";
            
            }
        }).then(function (data) {
            
            let translation_result = data["translations"][0]["text"];

            translation_result = replaceSubstiWithEquation(translation_result, equation_list, substi_sets);

            document.getElementById('result').textContent = translation_result;
            MathJax.typesetPromise()

            goOutputSection();

            // Texでの出力
            const editor = ace.edit("editor");
            editor.setValue("");
            let tex_output = changeEquationForTexOutput(translation_result);
            editor.setValue(tex_output);

            // バグ報告ボタンのリンク先にTexプログラムを事前に入れておく
            let link = document.getElementById('report_bug');
            link.setAttribute('href', 'https://docs.google.com/forms/d/e/1FAIpQLScvmBfEA2uHZEPfB42Xj0_5YauH5J_32gfRBU7COn16aR2NhQ/viewform?usp=pp_url&entry.1265959101=Your comment:%0A%0A--------------------------------------------------------------------------------------------------%0AInput: (Replace secret words with a string like xxx)%0A' + original_latex_code + '%0A--------------------------------------------------------------------------------------------------%0AOutput:%0A' + tex_output);

        }).catch(function(error) {
            document.getElementById('result').textContent = error.message;
        });
}

function checkColonSemicolon(latex_code) {
    // コロンとセミコロンが文章内にあるかをチェックし、ある場合警告を出す。
    // また、コロンとセミコロンを赤文字で表示させる。

    // コロンとセミコロンの数を調べる
    n_colon = (latex_code.match(/:/g)  || []).length;
    n_semicolon = (latex_code.match(/;/g)  || []).length;

    // コロンまたはセミコロンが存在する場合、注記を表示させる
    if (n_colon + n_semicolon > 0) {

        // 注記を表示
        const note_colon = document.getElementById('note_colon');
        note_colon.style.display = 'block';

        let note_content = "入力された文章には、<b>コロン</b>または<b>セミコロン</b>が含まれており、<u>翻訳が途切れる</u>可能性があります。<br />もし途切れている場合は、それらをピリオドに変えるなど、文章を訂正し再度 Run を押してください。<br /><br /><b>コロンまたはセミコロンが含まれる文</b>";

        // 注記の内容を決めるため、
        // ピリオドの位置リストを取得
        const matches = latex_code.matchAll(/\./g);
        const period_idices = [];
        for (const match of matches) {
            period_idices.push(match.index);
        }
    
        // 各コロンまたはセミコロンが、どの行数にあるのかと、その周辺の文を示す。
        let idx_colon = -1;
        for (let i = 0; i < n_colon; i++){
            // どの行数か
            idx_colon = latex_code.indexOf(':', idx_colon+1);
            const idx_period = latex_code.indexOf('.', idx_colon);
            const line_num = period_idices.indexOf(idx_period);

            // 周辺の文
            const text = latex_code.slice(idx_colon-50, idx_colon) + "<font color=\"red\" size=4><strong>:</strong></font>" + latex_code.slice(idx_colon+1, idx_colon+51);

            // 注記に書き込む
            if (line_num != -1) {
                note_content = note_content + "<br />" + line_num + "行目：" + text;
            } else {
                // コロンの後に、ピリオドがない場合
                note_content = note_content + "<br />" + "最終行：" + text;
            }
            
        }

        let idx_semicolon = -1;
        for (let i = 0; i < n_semicolon; i++){
            // どの行数か
            idx_semicolon = latex_code.indexOf(';', idx_semicolon+1);
            const idx_period = latex_code.indexOf('.', idx_semicolon);
            const line_num = period_idices.indexOf(idx_period);

            // 周辺の文
            const text = latex_code.slice(idx_semicolon-50, idx_semicolon) + "<font color=\"red\" size=4><strong>;</strong></font>" + latex_code.slice(idx_semicolon+1, idx_semicolon+51);

            // 注記に書き込む
            if (line_num != -1) {
                note_content = note_content + "<br />" + line_num + "行目：" + text;
            } else {
                // コロンの後に、ピリオドがない場合
                note_content = note_content + "<br />" + "最終行：" + text;
            }
            
        }

        // 注記の内容を表示する
        note_colon.innerHTML = note_content;
    } else {

        let note_colon = document.getElementById('note_colon');
        note_colon.style.display = 'none';
    }

}

function preprocessLatexCode(latex_code) {
    // LaTeXでは1回の改行は無視されて，2回の改行でやっと改行になるという仕様に対応するため，
    // 1改行の改行は削除して，2回の改行はそのままにする．
    
    let idx_newline = 0;
    let new_latex_code = "";

    while (true) {
        idx_newline = latex_code.search(/[^\n]\n[^\n]/);

        if (idx_newline == -1) {
            new_latex_code = new_latex_code + latex_code;
            break;
        }

        new_latex_code = new_latex_code + latex_code.slice(0, idx_newline + 1);
        latex_code = latex_code.slice(idx_newline + 2);

        idx_newline = idx_newline + 1;
    }

    return new_latex_code
}

function extractFirstEquation(latex_code) {

    let equation = "";
    let is_inline_eq = true;
    let idx_equation_start = 0;
    let idx_equation_end = 0;

    let idx_first_dollar  = latex_code.indexOf('$');
    let idx_second_dollar = latex_code.indexOf('$', idx_first_dollar + 1);

    if (idx_first_dollar != -1) {

        is_inline_eq = (idx_second_dollar - idx_first_dollar != 1);
    
        if (is_inline_eq) {
            
            idx_equation_start = idx_first_dollar;
            idx_equation_end = idx_second_dollar;
            
        } else {
    
            idx_equation_start = idx_first_dollar;
            idx_equation_end = latex_code.indexOf('$', idx_second_dollar + 1) + 1;
    
        }
    
        equation = latex_code.slice(idx_equation_start, idx_equation_end + 1);

    }

    return [equation, is_inline_eq, idx_equation_start, idx_equation_end];

}

function replaceEquationWithSubsti(equation, is_inline_eq, substi_sets) {

    let substi_code_list = [];
    let reduced_equation = "";
    let separated_equation = "";
    let equation_list = [];

    let str_punc = "";
    let idx_punc = 0;

    let substi = "";

    // 数式内にカンマ・ピリオドがある場合，前後で分割して，2つの数式にする
    if (is_inline_eq) {

        reduced_equation = equation;
        separated_equation = "";

        while (true) {

            [separated_equation, reduced_equation, str_punc, idx_punc] = splitEquationBeforeAndAfterSymbol(reduced_equation, /\.|,|;/, is_inline_eq);

            if (idx_punc == -1) {
                break;
            }
            
            separated_equation = keepLeftRightPair(separated_equation);

            substi = getSubstiString(substi_sets);

            substi_code_list.push(substi);
            substi_code_list.push(str_punc);
            substi_code_list.push(" ");

            equation_list.push(separated_equation);

        }

        // 空白だけの数式の時のみ処理
        if (!/^\\(\(|\[)\s*\\(\)|\])$/.test(reduced_equation)) {

            reduced_equation = keepLeftRightPair(reduced_equation);

            substi = getSubstiString(substi_sets);

            substi_code_list.push(substi);
            equation_list.push(reduced_equation);
            
        }

    } else {

        // 数式の末尾にカンマ・ピリオドがある場合のみ，それを数式の外に出す．
        idx_punc = equation.search(/(\.|,|;)\s*\\]/);
        no_end_punc = (idx_punc == -1);

        substi = getSubstiString(substi_sets);
        
        if (no_end_punc) {

            // ブロック数式の場合，前後に空白がない事が多いので，空白を入れる．
            substi_code_list.push(" ");
            substi_code_list.push(substi);
            substi_code_list.push(" ");
            equation_list.push(equation);
            
        } else {
            str_punc = equation[idx_punc];

            substi_code_list.push(" ");
            substi_code_list.push(substi);
            substi_code_list.push(str_punc);
            substi_code_list.push(" ");

            // 数式からカンマ・ピリオドを抜く
            equation = equation.slice(0, idx_punc) + " \\]";
            equation_list.push(equation);

        }    
    }

    let replaced_equation = substi_code_list.join("");

    return [replaced_equation, equation_list];

}

function changeEquationForMathjax(equation, is_inline_eq) {

    if (is_inline_eq) {

        equation = "\\(" + equation.slice(1, equation.length - 1) + "\\)";

    } else {

        equation = "\\[" + equation.slice(2, equation.length - 2) + "\\]";

    }

    return equation  

}

function changeEquationForTexOutput(outputForMathjax) {

    let outputForTex = outputForMathjax.replace(/\\\(/g, '$$').replace(/\\\)/g, '$$').replace(/\\\[/g, "$$$$").replace(/\\\]/g, "$$$$");

    return outputForTex

}

function splitEquationBeforeAndAfterSymbol(equation, symbol_reg, is_inline_eq) {

    let first_equation = "";
    let second_equation = "";
    let str_symbol = "";

    let idx_symbol = equation.search(symbol_reg);

    if (idx_symbol != -1) {

        str_symbol = equation[idx_symbol];
    
        // str_symbolの前をfirst_equation, 後をsecond_equationとする
        // reduced_equation -> separated_equation + punctuation + reduced_equation
        first_equation = equation.slice(0, idx_symbol);
        second_equation = equation.slice(idx_symbol + 1);
    
        // 分割するだけでは，\( \)の記号も分割されてしまいエラーが出るので，付け足す
        // e.g.
        // separated_equation : \( xxxx  -> \( xxxx \)
        // reduced_equation   :  xxxx \) -> \( xxxx \)
    
        if (is_inline_eq) {
    
            first_equation = first_equation + "\\)";
            second_equation = "\\(" + second_equation;
    
        } else {
    
            first_equation = first_equation + "\\]";
            second_equation = "\\[" + second_equation;
    
        }

    } else {
        second_equation = equation;
    }

    return [first_equation, second_equation, str_symbol, idx_symbol]

}

function keepLeftRightPair(equation) {

    let n_left  = (equation.match(/\\left[^a-z]/g)  || []).length;
    let n_right = (equation.match(/\\right[^a-z]/g) || []).length;
    let len_equation = equation.length;
    let len_equation_bra = 2; // the length of \\[ or \\]

    if (n_left == n_right) {
        ;
    } else if (n_left > n_right) {
        for (let i = 0; i < n_left-n_right; i++){
            equation = equation.slice(0, len_equation - len_equation_bra) + " \\right . " + equation.slice(len_equation - len_equation_bra);
        }
    } else {
        for (let i = 0; i < n_right-n_left; i++){
            equation = equation.slice(0, len_equation_bra) + " \\left . " + equation.slice(2);
        }
    }

    return equation

}

function getSubstiString(substi_sets) {

    let cnt = substi_sets.cnt;
    substi = substi_sets.pre + String(cnt).padStart(substi_sets.len_num, '0');
    cnt = cnt + 1;
    substi_sets.cnt = cnt;

    return substi
}

function replaceSubstiWithEquation(translation_result, equation_list, substi_sets) {
    // 翻訳結果の記号EQxxに実際の数式を代入

    let equation = "";
    let substi = "";

    for (let i = 0; i < equation_list.length; i++) {

        equation = equation_list[i];

        substi = new RegExp(substi_sets.pre + String(i).padStart(substi_sets.len_num, '0'), "ig");
        translation_result = translation_result.replace(substi, equation);
    }

    return translation_result
}

function goOutputSection() {

    const output_pos = document.getElementById("output").getBoundingClientRect().top;

    window.scrollTo({
        top: output_pos,
        behavior: 'smooth'
    });

}

function captureOutput() {
    html2canvas(document.getElementById("result")).then((canvas) => {
        const link = document.createElement('a')
        link.href = canvas.toDataURL()
        link.download = `result.png`
        link.click()
    })
}