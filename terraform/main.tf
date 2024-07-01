resource "aws_instance" "quiz_app" {
  ami           = "ami-0d2f6341ccecfd1b2"
  instance_type = "t2.micro"

  tags = {
    Name = "QuizAppInstance"
  }
}