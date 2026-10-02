function getFirstName(name?: string | null): string {
    return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function getSessionGreeting(languageCode: string, name?: string | null, reason?: string | null): string {
    const firstName = getFirstName(name);
    const lowerReason = (reason ?? "").toLowerCase();

    const isAnxiety = lowerReason.includes("anxiety") || lowerReason.includes("overthink");
    const isStress = lowerReason.includes("stress") || lowerReason.includes("burnout");
    const isLonely = lowerReason.includes("lonely") || lowerReason.includes("down");
    const isAdvice = lowerReason.includes("advice") || lowerReason.includes("relation") || lowerReason.includes("life");

    switch (languageCode) {
        case "hi-IN":
            if (isAnxiety) {
                return firstName
                    ? `नमस्ते ${firstName}, मैं TherapyxAI हूँ। मैं समझता हूँ कि आप चिंता और अत्यधिक विचारों से परेशान हैं। गहरी सांस लें — मैं आपकी बात सुनने और मदद के लिए यहाँ हूँ।`
                    : "नमस्ते, मैं TherapyxAI हूँ। मैं समझता हूँ कि आप चिंता और अत्यधिक विचारों से परेशान हैं। गहरी सांस लें — मैं आपकी मदद के लिए यहाँ हूँ।";
            }
            if (isStress) {
                return firstName
                    ? `नमस्ते ${firstName}, मैं TherapyxAI हूँ। मैं जानता हूँ कि आप तनाव या थकान महसूस कर रहे हैं। आज हम आराम से एक-एक करके बात करेंगे।`
                    : "नमस्ते, मैं TherapyxAI हूँ। मैं जानता हूँ कि आप तनाव महसूस कर रहे हैं। आज हम आराम से बात करेंगे।";
            }
            if (isLonely) {
                return firstName
                    ? `नमस्ते ${firstName}, मैं TherapyxAI हूँ। आपको अकेलेपन या उदासी को अकेले नहीं सहना पड़ेगा। मैं आपके साथ हूँ।`
                    : "नमस्ते, मैं TherapyxAI हूँ। आपको उदासी या अकेलेपन को अकेले नहीं सहना पड़ेगा। मैं आपके साथ हूँ।";
            }
            if (isAdvice) {
                return firstName
                    ? `नमस्ते ${firstName}, मैं TherapyxAI हूँ। आज मैं आपके विचारों, लक्ष्यों और रिश्तों को समझने में आपकी मदद करने के लिए यहाँ हूँ। आपके मन में क्या है?`
                    : "नमस्ते, मैं TherapyxAI हूँ। आज मैं आपके विचारों और रिश्तों को समझने में आपकी मदद के लिए यहाँ हूँ। आपके मन में क्या है?";
            }
            return firstName
                ? `नमस्ते ${firstName}, मैं TherapyxAI हूँ। आज मैं आपकी बात सुनने के लिए यहाँ हूँ।`
                : "नमस्ते, मैं TherapyxAI हूँ। आज मैं आपकी बात सुनने के लिए यहाँ हूँ।";

        case "mr-IN":
            if (isAnxiety) {
                return firstName
                    ? `नमस्कार ${firstName}, मी TherapyxAI आहे। मला समजते की तुम्ही काळजी आणि अतिविचारांमुळे त्रासलेले आहात। शांतपणे श्वास घ्या — मी तुमचे ऐकण्यासाठी इथे आहे।`
                    : "नमस्कार, मी TherapyxAI आहे। मला समजते की तुम्ही काळजी आणि अतिविचारांमुळे त्रासलेले आहात। शांतपणे श्वास घ्या — मी तुमचे ऐकण्यासाठी इथे आहे।";
            }
            if (isStress) {
                return firstName
                    ? `नमस्कार ${firstName}, मी TherapyxAI आहे। मला माहिती आहे की तुम्ही ताण किंवा थकवा अनुभवत आहात। चला आज हळूवार बोलूया।`
                    : "नमस्कार, मी TherapyxAI आहे। मला माहिती आहे की तुम्ही ताण अनुभवत आहात। चला आज हळूवार बोलूया।";
            }
            if (isLonely) {
                return firstName
                    ? `नमस्कार ${firstName}, मी TherapyxAI आहे। तुम्हाला एकटेपण किंवा उदास वाटणे एकट्याने सहन करण्याची गरज नाही। मी तुमच्यासोबत आहे।`
                    : "नमस्कार, मी TherapyxAI आहे। तुम्हाला एकटेपण किंवा उदास वाटणे एकट्याने सहन करण्याची गरज नाही। मी तुमच्यासोबत आहे।";
            }
            if (isAdvice) {
                return firstName
                    ? `नमस्कार ${firstName}, मी TherapyxAI आहे। आज तुमच्या मनातले विचार आणि नात्यांबद्दल बोलण्यासाठी मी इथे आहे। तुमच्या मनात काय चाललंय?`
                    : "नमस्कार, मी TherapyxAI आहे। आज तुमच्या मनातले विचार आणि नात्यांबद्दल बोलण्यासाठी मी इथे आहे। तुमच्या मनात काय चाललंय?";
            }
            return firstName
                ? `नमस्कार ${firstName}, मी TherapyxAI आहे। आज मी तुमचं ऐकण्यासाठी इथे आहे।`
                : "नमस्कार, मी TherapyxAI आहे। आज मी तुमचं ऐकण्यासाठी इथे आहे।";

        default:
            if (isAnxiety) {
                return firstName
                    ? `Hi ${firstName}, I am TherapyxAI. I understand you are dealing with anxiety or overthinking right now. Take a deep breath — I am here to listen and help you work through it.`
                    : "Hi, I am TherapyxAI. I understand you are dealing with anxiety or overthinking right now. Take a deep breath — I am here to listen and help you work through it.";
            }
            if (isStress) {
                return firstName
                    ? `Hi ${firstName}, I am TherapyxAI. I hear that you are feeling stressed or burned out. Let's take things one step at a time today.`
                    : "Hi, I am TherapyxAI. I hear that you are feeling stressed or burned out. Let's take things one step at a time today.";
            }
            if (isLonely) {
                return firstName
                    ? `Hi ${firstName}, I am TherapyxAI. You don't have to carry feeling lonely or down by yourself. I am right here with you.`
                    : "Hi, I am TherapyxAI. You don't have to carry feeling lonely or down by yourself. I am right here with you.";
            }
            if (isAdvice) {
                return firstName
                    ? `Hi ${firstName}, I am TherapyxAI. I'm here to help you process your thoughts, goals, and relationships today. What's on your mind?`
                    : "Hi, I am TherapyxAI. I'm here to help you process your thoughts, goals, and relationships today. What's on your mind?";
            }
            return firstName
                ? `Hi ${firstName}, I am TherapyxAI. I am here to listen to you today.`
                : "Hi, I am TherapyxAI. I am here to listen to you today.";
    }
}
