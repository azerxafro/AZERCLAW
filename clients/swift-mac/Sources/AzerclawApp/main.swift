import SwiftUI
import Starscream
import Combine

// MARK: - App Entry Point
@main
struct AzerclawApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 400, minHeight: 600)
                .background(Color.black)
        }
        .windowStyle(.hiddenTitleBar)
    }
}

// MARK: - WebSocket Client
class AzerclawClient: ObservableObject, WebSocketDelegate {
    @Published var messages: [ChatMessage] = []
    @Published var isConnected = false
    @Published var isThinking = false
    private var socket: WebSocket!
    
    init() {
        var request = URLRequest(url: URL(string: "ws://localhost:8080")!)
        request.timeoutInterval = 5
        socket = WebSocket(request: request)
        socket.delegate = self
        socket.connect()
    }
    
    func startChat() {
        let msg = ["type": "start_chat"]
        if let data = try? JSONSerialization.data(withJSONObject: msg) {
            socket.write(data: data)
        }
    }
    
    func send(text: String) {
        messages.append(ChatMessage(text: text, isUser: true))
        let msg = ["type": "chat_message", "payload": ["message": text]] as [String : Any]
        if let data = try? JSONSerialization.data(withJSONObject: msg) {
            socket.write(data: data)
            isThinking = true
        }
    }
    
    func didReceive(event: WebSocketEvent, client: WebSocketClient) {
        DispatchQueue.main.async {
            switch event {
            case .connected:
                self.isConnected = true
                self.startChat()
            case .disconnected:
                self.isConnected = false
            case .text(let string):
                if let data = string.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let type = json["type"] as? String {
                    
                    if type == "text" || type == "system" {
                        if let payload = json["payload"] as? String {
                            self.messages.append(ChatMessage(text: payload, isUser: false, isSystem: type == "system"))
                            self.isThinking = false
                        }
                    }
                }
            default:
                break
            }
        }
    }
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let text: String
    let isUser: Bool
    var isSystem = false
}

// MARK: - UI
struct ContentView: View {
    @StateObject private var client = AzerclawClient()
    @State private var inputText = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("AZERCLAW")
                    .font(.headline)
                    .foregroundColor(.red)
                    .fontWeight(.black)
                Spacer()
                Circle()
                    .fill(client.isConnected ? Color.green : Color.red)
                    .frame(width: 10, height: 10)
            }
            .padding()
            .background(Color(white: 0.1))
            
            // Messages
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(client.messages) { msg in
                        HStack {
                            if msg.isUser { Spacer() }
                            Text(msg.text)
                                .padding(10)
                                .background(msg.isUser ? Color.red.opacity(0.8) : (msg.isSystem ? Color.yellow.opacity(0.2) : Color(white: 0.2)))
                                .foregroundColor(msg.isSystem ? .yellow : .white)
                                .cornerRadius(8)
                            if !msg.isUser { Spacer() }
                        }
                    }
                    if client.isThinking {
                        HStack {
                            Text("🔪 Plotting...")
                                .foregroundColor(.red)
                                .italic()
                            Spacer()
                        }
                        .padding(.top, 4)
                    }
                }
                .padding()
            }
            
            // Input
            HStack {
                TextField("Command...", text: $inputText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .padding(10)
                    .background(Color(white: 0.2))
                    .cornerRadius(8)
                    .foregroundColor(.white)
                    .onSubmit {
                        sendMessage()
                    }
                
                Button(action: sendMessage) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(.red)
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.horizontal, 8)
            }
            .padding()
            .background(Color(white: 0.1))
        }
    }
    
    private func sendMessage() {
        guard !inputText.isEmpty else { return }
        client.send(text: inputText)
        inputText = ""
    }
}
